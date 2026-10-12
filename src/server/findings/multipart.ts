import "server-only";

import { MAX_FINDING_PHOTO_BYTES, MAX_FINDING_PHOTOS } from "@/config/findings";

import { FindingRequestError } from "./errors";

/**
 * Room for the text fields and multipart framing on top of 10 photos.
 * Checked against Content-Length before the body is read, and again
 * while non-photo parts arrive.
 */
export const FINDING_FIELDS_ALLOWANCE_BYTES = 64 * 1024;

export const MAX_FINDING_UPLOAD_BYTES =
  MAX_FINDING_PHOTOS * MAX_FINDING_PHOTO_BYTES + FINDING_FIELDS_ALLOWANCE_BYTES;

export type FindingMultipartPhoto = {
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Read a multipart body from the request stream.
 * An 11th photo, a photo past 15 MB, or field bytes past the allowance
 * cancels the stream. The rest of the body is not pulled.
 */
export async function readFindingMultipart(input: {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
}): Promise<{
  fields: Record<string, string>;
  photos: FindingMultipartPhoto[];
}> {
  const boundary = boundaryFrom(input.contentType);
  const reader = input.stream.getReader();
  const parser = new MultipartParser(boundary);

  try {
    while (!parser.done) {
      const { done, value } = await reader.read();
      if (done) {
        parser.finish();
        break;
      }
      parser.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (error instanceof FindingRequestError) {
      throw error;
    }
    throw new FindingRequestError(
      "validation_error",
      "Upload could not be read.",
    );
  } finally {
    reader.releaseLock();
  }

  return { fields: parser.fields, photos: parser.photos };
}

class MultipartParser {
  readonly fields: Record<string, string> = {};
  readonly photos: FindingMultipartPhoto[] = [];
  done = false;

  private buffer = new Uint8Array(0);
  private phase: "boundary" | "after" | "headers" | "body" = "boundary";
  private fieldBytes = 0;
  private photoCount = 0;
  private part: Part | null = null;
  private readonly dashBoundary: Uint8Array;
  private readonly bodyDelimiter: Uint8Array;

  constructor(boundary: string) {
    this.dashBoundary = textEncoder.encode(`--${boundary}`);
    this.bodyDelimiter = textEncoder.encode(`\r\n--${boundary}`);
  }

  push(chunk: Uint8Array): void {
    this.buffer = concat(this.buffer, chunk);
    this.drain();
  }

  finish(): void {
    this.drain();
    if (!this.done) {
      throw new FindingRequestError(
        "validation_error",
        "Upload could not be read.",
      );
    }
  }

  private drain(): void {
    while (!this.done) {
      if (this.phase === "boundary") {
        if (!this.takeBoundary()) {
          return;
        }
      } else if (this.phase === "after") {
        if (!this.takeAfter()) {
          return;
        }
      } else if (this.phase === "headers") {
        if (!this.takeHeaders()) {
          return;
        }
      } else if (!this.takeBody()) {
        return;
      }
    }
  }

  private takeBoundary(): boolean {
    const at = indexOf(this.buffer, this.dashBoundary);
    if (at < 0) {
      this.keepTail(this.dashBoundary.length - 1);
      return false;
    }

    this.consumeFieldBytes(at);
    this.buffer = this.buffer.subarray(at + this.dashBoundary.length);
    this.phase = "after";
    return true;
  }

  private takeAfter(): boolean {
    if (this.buffer.length < 2) {
      return false;
    }
    return this.afterBoundary();
  }

  private afterBoundary(): boolean {
    if (this.buffer[0] === 45 && this.buffer[1] === 45) {
      this.done = true;
      this.buffer = new Uint8Array(0);
      return true;
    }
    if (this.buffer[0] === 13 && this.buffer[1] === 10) {
      this.buffer = this.buffer.subarray(2);
      this.phase = "headers";
      return true;
    }
    throw new FindingRequestError(
      "validation_error",
      "Upload could not be read.",
    );
  }

  private takeHeaders(): boolean {
    const end = indexOf(this.buffer, headerSeparator);
    if (end < 0) {
      this.keepTail(headerSeparator.length - 1);
      return false;
    }

    const raw = textDecoder.decode(this.buffer.subarray(0, end));
    this.consumeFieldBytes(end + headerSeparator.length);
    this.buffer = this.buffer.subarray(end + headerSeparator.length);
    this.part = this.startPart(raw);
    this.phase = "body";
    return true;
  }

  private takeBody(): boolean {
    const at = indexOf(this.buffer, this.bodyDelimiter);
    if (at < 0) {
      const keep = this.bodyDelimiter.length - 1;
      const safeLength = Math.max(0, this.buffer.length - keep);
      this.acceptBody(this.buffer.subarray(0, safeLength));
      this.buffer = this.buffer.subarray(safeLength);
      return false;
    }

    this.acceptBody(this.buffer.subarray(0, at));
    this.finishPart();
    this.buffer = this.buffer.subarray(at + this.bodyDelimiter.length);
    this.phase = "after";
    return true;
  }

  private startPart(headers: string): Part {
    const disposition = headerValue(headers, "content-disposition");
    const name = dispositionParameter(disposition, "name");
    const fileName = dispositionParameter(disposition, "filename");
    if (!name) {
      throw new FindingRequestError(
        "validation_error",
        "Upload could not be read.",
      );
    }

    if (fileName === null) {
      if (name === "photos") {
        throw new FindingRequestError(
          "validation_error",
          "photos must be files.",
          [{ path: "photos", message: "photos must be files." }],
        );
      }
      if (Object.hasOwn(this.fields, name)) {
        throw new FindingRequestError(
          "validation_error",
          `${name} was sent more than once.`,
          [{ path: name, message: `${name} was sent more than once.` }],
        );
      }
      return { kind: "field", name, chunks: [] };
    }

    if (name !== "photos") {
      throw new FindingRequestError(
        "validation_error",
        `${name} must be text.`,
        [{ path: name, message: `${name} must be text.` }],
      );
    }

    this.photoCount += 1;
    if (this.photoCount > MAX_FINDING_PHOTOS) {
      throw new FindingRequestError(
        "too_many_photos",
        `A finding accepts at most ${MAX_FINDING_PHOTOS} photos.`,
      );
    }

    return {
      kind: "photo",
      fileName,
      mediaType: headerValue(headers, "content-type"),
      chunks: [],
      size: 0,
    };
  }

  private acceptBody(bytes: Uint8Array): void {
    if (bytes.byteLength === 0 || !this.part) {
      return;
    }
    if (this.part.kind === "field") {
      this.consumeFieldBytes(bytes.byteLength);
      this.part.chunks.push(bytes);
      return;
    }

    this.part.size += bytes.byteLength;
    if (this.part.size > MAX_FINDING_PHOTO_BYTES) {
      throw new FindingRequestError(
        "payload_too_large",
        "A photo is larger than 15 MB.",
      );
    }
    this.part.chunks.push(bytes);
  }

  private finishPart(): void {
    const part = this.part;
    this.part = null;
    if (!part) {
      return;
    }
    const bytes =
      part.kind === "photo"
        ? concatChunks(part.chunks, part.size)
        : concatChunks(part.chunks);
    if (part.kind === "field") {
      this.fields[part.name] = textDecoder.decode(bytes);
      return;
    }
    this.photos.push({
      fileName: part.fileName,
      mediaType: part.mediaType,
      bytes,
    });
  }

  private consumeFieldBytes(count: number): void {
    if (count <= 0) {
      return;
    }
    this.fieldBytes += count;
    if (this.fieldBytes > FINDING_FIELDS_ALLOWANCE_BYTES) {
      throw new FindingRequestError(
        "payload_too_large",
        "The upload is larger than 10 photos of 15 MB.",
      );
    }
  }

  private keepTail(keep: number): void {
    if (this.buffer.length <= keep) {
      return;
    }
    this.consumeFieldBytes(this.buffer.length - keep);
    this.buffer = this.buffer.subarray(this.buffer.length - keep);
  }
}

type Part =
  | { kind: "field"; name: string; chunks: Uint8Array[] }
  | {
      kind: "photo";
      fileName: string;
      mediaType: string;
      chunks: Uint8Array[];
      size: number;
    };

const headerSeparator = textEncoder.encode("\r\n\r\n");

function boundaryFrom(contentType: string): string {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = (match?.[1] ?? match?.[2])?.trim();
  if (!boundary) {
    throw new FindingRequestError(
      "validation_error",
      "Upload must be multipart/form-data.",
    );
  }
  return boundary;
}

function headerValue(headers: string, name: string): string {
  const pattern = new RegExp(`^${name}:[ \\t]*([^\\r\\n]*)`, "im");
  return pattern.exec(headers)?.[1]?.trim() ?? "";
}

function dispositionParameter(
  disposition: string,
  name: string,
): string | null {
  const parameter = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const atBoundary = `(?:^|;)\\s*${parameter}`;
  const quoted = new RegExp(`${atBoundary}="([^"]*)"`, "i").exec(disposition);
  if (quoted?.[1] !== undefined) {
    return quoted[1];
  }
  const plain = new RegExp(`${atBoundary}=([^;]+)`, "i").exec(disposition);
  if (plain?.[1] === undefined) {
    return null;
  }
  return plain[1].trim();
}

function indexOf(haystack: Uint8Array, needle: Uint8Array): number {
  if (needle.length === 0 || haystack.length < needle.length) {
    return -1;
  }
  const last = haystack.length - needle.length;
  for (let start = 0; start <= last; start += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return start;
    }
  }
  return -1;
}

function concat(left: Uint8Array, right: Uint8Array) {
  const out = new Uint8Array(left.byteLength + right.byteLength);
  out.set(left, 0);
  out.set(right, left.byteLength);
  return out;
}

function concatChunks(chunks: Uint8Array[], knownSize?: number): Uint8Array {
  let length = knownSize ?? 0;
  if (knownSize === undefined) {
    for (const chunk of chunks) {
      length += chunk.byteLength;
    }
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

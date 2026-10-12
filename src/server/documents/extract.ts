import "server-only";

import mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

/** Media types extractText accepts. Markdown is read as text, not rendered. */
export const SUPPORTED_DOCUMENT_MEDIA_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
] as const;

const DOCX_MEDIA_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Markdown aliases some clients send. They are stored as text/markdown. */
const TEXT_MEDIA_TYPES = new Set<string>([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/markdown",
]);

export class UnsupportedDocumentMediaTypeError extends Error {
  readonly mediaType: string;

  constructor(mediaType: string) {
    super(
      `Unsupported document media type "${mediaType}". Supported types: ${SUPPORTED_DOCUMENT_MEDIA_TYPES.join(", ")}.`,
    );
    this.name = "UnsupportedDocumentMediaTypeError";
    this.mediaType = mediaType;
  }
}

export type ExtractedSegment = {
  /** 1-based page number, or null when the format has no pages. */
  page: number | null;
  text: string;
};

export type ExtractedDocument = {
  mediaType: string;
  segments: ExtractedSegment[];
};

/**
 * Read UTF-8 text from a PDF, DOCX, or plain text / Markdown body.
 * PDF segments keep 1-based page numbers. DOCX and text have no page map,
 * so their single segment uses page null.
 */
export async function extractText(
  data: Uint8Array,
  mimeType: string,
): Promise<ExtractedDocument> {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError("Document body must be a Uint8Array or Buffer");
  }

  if (data.byteLength === 0) {
    throw new Error("Cannot extract text from an empty document");
  }

  const mediaType = normalizeMediaType(mimeType);

  if (mediaType === "application/pdf") {
    return extractPdf(data);
  }

  if (mediaType === DOCX_MEDIA_TYPE) {
    return extractDocx(data);
  }

  if (TEXT_MEDIA_TYPES.has(mediaType)) {
    return {
      mediaType: mediaType === "text/plain" ? mediaType : "text/markdown",
      segments: [{ page: null, text: decodeUtf8(data) }],
    };
  }

  throw new UnsupportedDocumentMediaTypeError(mimeType);
}

function normalizeMediaType(mimeType: string): string {
  const [base] = mimeType.split(";");
  return base?.trim().toLowerCase() ?? "";
}

function decodeUtf8(data: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch (error) {
    throw new Error("Could not decode text document as UTF-8", {
      cause: error,
    });
  }
}

async function extractPdf(data: Uint8Array): Promise<ExtractedDocument> {
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data);

  try {
    const pdf = await getDocumentProxy(bytes);
    try {
      const extracted = await extractPdfText(pdf, { mergePages: false });
      if (!Array.isArray(extracted.text)) {
        throw new Error("PDF text extraction did not return pages");
      }

      return {
        mediaType: "application/pdf",
        segments: extracted.text.map((text, index) => ({
          page: index + 1,
          text,
        })),
      };
    } finally {
      await pdf.loadingTask.destroy();
    }
  } catch (error) {
    throw new Error("Could not extract text from PDF", { cause: error });
  }
}

async function extractDocx(data: Uint8Array): Promise<ExtractedDocument> {
  try {
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(data),
    });
    const failures = result.messages.filter(
      (message) => message.type === "error",
    );
    if (failures.length > 0) {
      throw new Error(failures.map((message) => message.message).join("; "));
    }

    return {
      mediaType: DOCX_MEDIA_TYPE,
      segments: [{ page: null, text: result.value }],
    };
  } catch (error) {
    throw new Error("Could not extract text from DOCX", { cause: error });
  }
}

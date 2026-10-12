import { describe, expect, it } from "vitest";

import { MAX_FINDING_PHOTO_BYTES, MAX_FINDING_PHOTOS } from "@/config/findings";

import { readFindingMultipart } from "./multipart";

const boundary = "----shipshape";
const encoder = new TextEncoder();
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function concat(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function photoPart(name: string, body: Uint8Array): Uint8Array {
  return concat([
    encoder.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="photos"; filename="${name}"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ),
    body,
  ]);
}

function withBreak(parts: Uint8Array[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  parts.forEach((part, index) => {
    if (index > 0) {
      chunks.push(encoder.encode("\r\n"));
    }
    chunks.push(part);
  });
  return concat(chunks);
}

function countingStream(first: Uint8Array, extra: Uint8Array) {
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (pulls > 24) {
        controller.error(new Error("parser kept reading"));
        return;
      }
      controller.enqueue(pulls === 1 ? first : extra);
    },
  });
  return {
    stream,
    pulls: () => pulls,
  };
}

describe("readFindingMultipart", () => {
  it("reads the text fields and photos a form would send", async () => {
    const form = new FormData();
    form.set("assetId", "550e8400-e29b-41d4-a716-446655440022");
    form.set("description", "Cracked cover.");
    form.set("severity", "high");
    form.append("photos", new File([jpeg], "bay.jpg", { type: "image/jpeg" }));
    const request = new Request("http://localhost/api/findings", {
      method: "POST",
      body: form,
    });

    const parsed = await readFindingMultipart({
      stream: request.body as ReadableStream<Uint8Array>,
      contentType: request.headers.get("content-type") ?? "",
    });

    expect(parsed.fields).toMatchObject({
      assetId: "550e8400-e29b-41d4-a716-446655440022",
      description: "Cracked cover.",
      severity: "high",
    });
    expect(parsed.photos).toEqual([
      { fileName: "bay.jpg", mediaType: "image/jpeg", bytes: jpeg },
    ]);
  });

  it("stops before later bytes when an 11th photo arrives", async () => {
    const photos = Array.from({ length: MAX_FINDING_PHOTOS }, (_, index) =>
      photoPart(`bay-${index}.jpg`, jpeg),
    );
    const first = concat([
      withBreak(photos),
      encoder.encode(
        `\r\n--${boundary}\r\nContent-Disposition: form-data; name="photos"; filename="extra.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
      ),
    ]);
    const source = countingStream(first, new Uint8Array(1024 * 1024));

    await expect(
      readFindingMultipart({
        stream: source.stream,
        contentType: `multipart/form-data; boundary=${boundary}`,
      }),
    ).rejects.toMatchObject({ code: "too_many_photos", status: 400 });
    expect(source.pulls()).toBe(1);
  });

  it("stops pulling once a photo passes 15 MB", async () => {
    const first = encoder.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="photos"; filename="big.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    );
    const source = countingStream(first, new Uint8Array(1024 * 1024));

    await expect(
      readFindingMultipart({
        stream: source.stream,
        contentType: `multipart/form-data; boundary=${boundary}`,
      }),
    ).rejects.toMatchObject({ code: "payload_too_large", status: 413 });

    const headerPulls = 1;
    const allowedMegabytes = MAX_FINDING_PHOTO_BYTES / (1024 * 1024);
    expect(source.pulls()).toBe(headerPulls + allowedMegabytes + 1);
  });
});

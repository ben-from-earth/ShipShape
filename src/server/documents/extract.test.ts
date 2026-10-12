import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { documentChunkSchema } from "@/schemas";

import { chunkText } from "./chunk";
import { UnsupportedDocumentMediaTypeError, extractText } from "./extract";

const fixtures = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.join(fixtures, name)));
}

describe("extractText", () => {
  it("reads plain text and markdown, including a charset parameter", async () => {
    const plain = await extractText(
      fixture("sample.txt"),
      "text/plain; charset=utf-8",
    );
    expect(plain.mediaType).toBe("text/plain");
    expect(plain.segments).toEqual([
      {
        page: null,
        text: "Bent support near the access hatch.\nThe plate is cracked along the weld.\n",
      },
    ]);

    const markdown = await extractText(fixture("sample.md"), "text/x-markdown");
    expect(markdown.mediaType).toBe("text/markdown");
    expect(markdown.segments[0]?.page).toBeNull();
    expect(markdown.segments[0]?.text).toContain("# Hatch inspection");
    expect(markdown.segments[0]?.text).toContain("**support**");
  });

  it("reads a DOCX without inventing page numbers", async () => {
    const extracted = await extractText(
      fixture("sample.docx"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    expect(extracted.mediaType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(extracted.segments).toHaveLength(1);
    expect(extracted.segments[0]?.page).toBeNull();
    expect(extracted.segments[0]?.text).toContain(
      "Bent support near the access hatch.",
    );
    expect(extracted.segments[0]?.text).toContain(
      "The plate is cracked along the weld.",
    );
  });

  it("reads PDF pages and chunking keeps those page numbers", async () => {
    const extracted = await extractText(
      fixture("sample.pdf"),
      "application/pdf",
    );

    expect(extracted.mediaType).toBe("application/pdf");
    expect(extracted.segments.map((segment) => segment.page)).toEqual([1, 2]);
    expect(extracted.segments[0]?.text).toContain("bent support");
    expect(extracted.segments[1]?.text).toContain("access hatch");

    const chunks = chunkText(extracted);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ pageStart: 1, pageEnd: 2 });
    expect(documentChunkSchema.parse(chunks[0])).toEqual(chunks[0]);
  });

  it("rejects unsupported, empty, and invalid text documents", async () => {
    const zip = extractText(Buffer.from("PK"), "application/zip");
    await expect(zip).rejects.toBeInstanceOf(UnsupportedDocumentMediaTypeError);
    await expect(zip).rejects.toThrow(/application\/zip/);

    await expect(extractText(new Uint8Array(), "text/plain")).rejects.toThrow(
      /empty document/,
    );

    await expect(
      extractText(new Uint8Array([0xff]), "text/plain"),
    ).rejects.toThrow(/UTF-8/);

    await expect(
      extractText(new TextEncoder().encode("%PDF-1.4 nope"), "application/pdf"),
    ).rejects.toThrow(/PDF/);
  });
});

import { describe, expect, it } from "vitest";

import {
  DOCUMENT_UPLOAD_EXTENSIONS,
  DOCUMENT_UPLOAD_MEDIA_TYPES,
  DOCUMENT_UPLOAD_TYPES,
  MAX_DOCUMENT_UPLOAD_BYTES,
  canonicalUploadMediaType,
  documentFileExtension,
  mediaTypeForExtension,
} from "@/config/documents";

describe("document upload config", () => {
  it("lists each extension and media type once", () => {
    expect(new Set(DOCUMENT_UPLOAD_EXTENSIONS).size).toBe(
      DOCUMENT_UPLOAD_EXTENSIONS.length,
    );
    expect(new Set(DOCUMENT_UPLOAD_MEDIA_TYPES).size).toBe(
      DOCUMENT_UPLOAD_MEDIA_TYPES.length,
    );
    expect(DOCUMENT_UPLOAD_EXTENSIONS).toEqual([
      ".pdf",
      ".docx",
      ".txt",
      ".md",
      ".markdown",
    ]);
    expect(MAX_DOCUMENT_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  it("stores markdown aliases as text/markdown", () => {
    expect(canonicalUploadMediaType("text/x-markdown")).toBe("text/markdown");
    expect(
      canonicalUploadMediaType("application/markdown; charset=utf-8"),
    ).toBe("text/markdown");
    expect(mediaTypeForExtension(".md")).toBe("text/markdown");
    expect(mediaTypeForExtension(".markdown")).toBe("text/markdown");
    expect(canonicalUploadMediaType("image/png")).toBeNull();
    expect(documentFileExtension("reports\\Hatch Notes.PDF")).toBe(".pdf");
    expect(DOCUMENT_UPLOAD_TYPES).toHaveLength(4);
  });
});

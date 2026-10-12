/**
 * Upload rules shared by the client and the server.
 * No server imports: a form can read these without pulling in extraction.
 *
 * `mediaTypes[0]` is the type we store. Later entries are aliases some
 * clients send for the same extension (markdown, mostly).
 */

export const MAX_DOCUMENT_UPLOAD_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_UPLOAD_TYPES = [
  {
    extensions: [".pdf"],
    mediaTypes: ["application/pdf"],
  },
  {
    extensions: [".docx"],
    mediaTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  {
    extensions: [".txt"],
    mediaTypes: ["text/plain"],
  },
  {
    extensions: [".md", ".markdown"],
    mediaTypes: ["text/markdown", "text/x-markdown", "application/markdown"],
  },
] as const;

export const DOCUMENT_UPLOAD_EXTENSIONS = DOCUMENT_UPLOAD_TYPES.flatMap(
  (type) => type.extensions,
);

/** Every accepted Content-Type, including markdown aliases. */
export const DOCUMENT_UPLOAD_MEDIA_TYPES = DOCUMENT_UPLOAD_TYPES.flatMap(
  (type) => type.mediaTypes,
);

/** Stored media type for an extension such as ".pdf", or null. */
export function mediaTypeForExtension(extension: string): string | null {
  const normalized = extension.toLowerCase();
  const match = DOCUMENT_UPLOAD_TYPES.find((type) =>
    type.extensions.some((item) => item === normalized),
  );
  return match?.mediaTypes[0] ?? null;
}

/**
 * Stored media type for a Content-Type header, or null when it is not
 * one of DOCUMENT_UPLOAD_MEDIA_TYPES. Parameters such as charset are ignored.
 */
export function canonicalUploadMediaType(mimeType: string): string | null {
  const [base] = mimeType.split(";");
  const normalized = base?.trim().toLowerCase() ?? "";
  const match = DOCUMENT_UPLOAD_TYPES.find((type) =>
    type.mediaTypes.some((item) => item === normalized),
  );
  return match?.mediaTypes[0] ?? null;
}

/** Extension of a file name, including the dot, or "" when there is none. */
export function documentFileExtension(fileName: string): string {
  const base = fileName.replaceAll("\\", "/").split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return base.slice(dot).toLowerCase();
}

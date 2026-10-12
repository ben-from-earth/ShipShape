/**
 * Client-side upload checks for the drop zone.
 *
 * TODO: import `MAX_DOCUMENT_UPLOAD_BYTES`, `DOCUMENT_UPLOAD_EXTENSIONS`,
 * and `DOCUMENT_UPLOAD_MEDIA_TYPES` from `@/config/documents` when PR #12
 * merges. The values below mirror `src/config/documents.ts` on that branch.
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

/** File-picker `accept` value: extensions and media types. */
export const UPLOAD_ACCEPT = [
  ...DOCUMENT_UPLOAD_EXTENSIONS,
  ...DOCUMENT_UPLOAD_MEDIA_TYPES,
].join(",");

const TYPE_MESSAGE = "Use a PDF, Word, plain text, or Markdown file.";
const SIZE_MESSAGE = "The file is larger than 10 MB.";

/**
 * Stored media type, preferring a known Content-Type and otherwise the
 * extension. An empty type still matches a known extension.
 */
export function mediaTypeForFile(name: string, type: string): string | null {
  const declared = canonicalUploadMediaType(type);
  if (declared) {
    return declared;
  }

  return mediaTypeForExtension(documentFileExtension(name));
}

/** Client-side reason to refuse a file, or null when it can be uploaded. */
export function uploadIssue(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!mediaTypeForFile(file.name, file.type)) {
    return TYPE_MESSAGE;
  }

  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    return SIZE_MESSAGE;
  }

  return null;
}

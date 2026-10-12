import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  canonicalUploadMediaType,
  documentFileExtension,
  mediaTypeForExtension,
} from "@/config/documents";

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

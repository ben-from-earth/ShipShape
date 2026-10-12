import "server-only";

import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  canonicalUploadMediaType,
  documentFileExtension,
  mediaTypeForExtension,
} from "@/config/documents";

import { DocumentRequestError } from "./errors";

export { MAX_DOCUMENT_UPLOAD_BYTES };

/**
 * Extra bytes allowed on Content-Length for the multipart envelope
 * around a file of MAX_DOCUMENT_UPLOAD_BYTES.
 */
export const MULTIPART_OVERHEAD_BYTES = 256 * 1024;

/**
 * Reject a file the extractor cannot read.
 * Extension and media type both have to be on the shared upload list,
 * and they have to name the same stored type.
 */
export function assertSupportedDocument(input: {
  fileName: string;
  mediaType: string;
  byteLength: number;
  maxBytes?: number;
}): { mediaType: string } {
  const maxBytes = input.maxBytes ?? MAX_DOCUMENT_UPLOAD_BYTES;

  if (!Number.isInteger(input.byteLength) || input.byteLength < 0) {
    throw new DocumentRequestError(
      "validation_error",
      "The file size is invalid.",
    );
  }

  if (input.byteLength === 0) {
    throw new DocumentRequestError("validation_error", "The file is empty.");
  }

  if (input.byteLength > maxBytes) {
    throw new DocumentRequestError(
      "payload_too_large",
      `The file is larger than ${formatByteLimit(maxBytes)}.`,
    );
  }

  const extension = documentFileExtension(input.fileName);
  const expected = mediaTypeForExtension(extension);
  if (expected === null) {
    throw new DocumentRequestError(
      "unsupported_media_type",
      "This file type is not supported. Upload a PDF, DOCX, TXT, or Markdown file.",
    );
  }

  const declared = input.mediaType.trim();
  if (declared.length === 0) {
    throw new DocumentRequestError(
      "validation_error",
      "A media type is required.",
      [{ path: "file", message: "A media type is required." }],
    );
  }

  const mediaType = canonicalUploadMediaType(declared);
  if (mediaType === null) {
    throw new DocumentRequestError(
      "unsupported_media_type",
      "This file type is not supported. Upload a PDF, DOCX, TXT, or Markdown file.",
    );
  }

  if (mediaType !== expected) {
    throw new DocumentRequestError(
      "unsupported_media_type",
      "The file extension does not match its media type.",
    );
  }

  return { mediaType };
}

function formatByteLimit(bytes: number): string {
  const mebibyte = 1024 * 1024;
  if (bytes % mebibyte === 0) {
    return `${bytes / mebibyte} MB`;
  }
  return `${bytes} bytes`;
}

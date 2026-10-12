import "server-only";

const STATUS_BY_CODE = {
  validation_error: 400,
  invalid_org_id: 400,
  unknown_organization: 400,
  payload_too_large: 413,
  unsupported_media_type: 415,
} as const;

export type DocumentErrorCode = keyof typeof STATUS_BY_CODE;

export type DocumentErrorDetail = {
  path: string;
  message: string;
};

/**
 * A request the document API can refuse without a 500.
 * The route maps `code` to the HTTP status and the shared error schema.
 */
export class DocumentRequestError extends Error {
  readonly code: DocumentErrorCode;
  readonly status: (typeof STATUS_BY_CODE)[DocumentErrorCode];
  readonly details?: DocumentErrorDetail[];

  constructor(
    code: DocumentErrorCode,
    message: string,
    details?: DocumentErrorDetail[],
  ) {
    super(message);
    this.name = "DocumentRequestError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function detailsFromZod(error: {
  issues: readonly { path: readonly PropertyKey[]; message: string }[];
}): DocumentErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((part) => String(part)).join("."),
    message: issue.message,
  }));
}

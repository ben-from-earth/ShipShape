import "server-only";

import { FINDING_ERROR_HTTP_STATUS } from "@/config/findings";
import { apiErrorSchema } from "@/schemas";
import { DocumentRequestError } from "@/server/documents/errors";
import { INTERNAL_ERROR_MESSAGE } from "@/server/http/api";

export type FindingErrorDetail = {
  path: string;
  message: string;
};

/**
 * A request the findings API can refuse without a 500.
 * Status comes from FINDING_ERROR_HTTP_STATUS, including the codes
 * shared with document uploads.
 */
export class FindingRequestError extends Error {
  readonly code: keyof typeof FINDING_ERROR_HTTP_STATUS;
  readonly status: (typeof FINDING_ERROR_HTTP_STATUS)[keyof typeof FINDING_ERROR_HTTP_STATUS];
  readonly details?: FindingErrorDetail[];

  constructor(
    code: keyof typeof FINDING_ERROR_HTTP_STATUS,
    message: string,
    details?: FindingErrorDetail[],
  ) {
    super(message);
    this.name = "FindingRequestError";
    this.code = code;
    this.status = FINDING_ERROR_HTTP_STATUS[code];
    this.details = details;
  }
}

type Refusable = {
  code: string;
  message: string;
  status: number;
  details?: FindingErrorDetail[];
};

/** JSON error body matching apiErrorSchema. Unexpected errors stay generic. */
export function findingErrorResponse(error: unknown): Response {
  if (isRefusable(error)) {
    const parsed = apiErrorSchema.safeParse({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && error.details.length > 0
          ? { details: error.details }
          : {}),
      },
    });
    if (parsed.success) {
      return Response.json(parsed.data, { status: error.status });
    }
  }

  console.error(error);
  return Response.json(
    {
      error: {
        code: "internal_error",
        message: INTERNAL_ERROR_MESSAGE,
      },
    },
    { status: 500 },
  );
}

function isRefusable(error: unknown): error is Refusable {
  return (
    error instanceof FindingRequestError ||
    error instanceof DocumentRequestError
  );
}

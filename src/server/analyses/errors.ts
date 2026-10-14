import "server-only";

import { apiErrorSchema } from "@/schemas";
import { DocumentRequestError } from "@/server/documents/errors";
import { INTERNAL_ERROR_MESSAGE } from "@/server/http/api";

const ANALYSIS_ERROR_HTTP_STATUS = {
  validation_error: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_state: 409,
  invalid_assignee: 422,
} as const;

export type AnalysisErrorCode = keyof typeof ANALYSIS_ERROR_HTTP_STATUS;

export type AnalysisErrorDetail = {
  path: string;
  message: string;
};

/** A request the analyses API can refuse without a 500. */
export class AnalysisRequestError extends Error {
  readonly code: AnalysisErrorCode;
  readonly status: (typeof ANALYSIS_ERROR_HTTP_STATUS)[AnalysisErrorCode];
  readonly details?: AnalysisErrorDetail[];

  constructor(
    code: AnalysisErrorCode,
    message: string,
    details?: AnalysisErrorDetail[],
  ) {
    super(message);
    this.name = "AnalysisRequestError";
    this.code = code;
    this.status = ANALYSIS_ERROR_HTTP_STATUS[code];
    this.details = details;
  }
}

type Refusable = {
  code: string;
  message: string;
  status: number;
  details?: AnalysisErrorDetail[];
};

/** JSON error body matching apiErrorSchema. Unexpected errors stay generic. */
export function analysisErrorResponse(error: unknown): Response {
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
    error instanceof AnalysisRequestError ||
    error instanceof DocumentRequestError
  );
}

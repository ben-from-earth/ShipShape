import { isDemoData } from "@/config/demo";
import { ORG_ID_HEADER, orgId } from "@/config/org";
import { apiErrorDetailSchema, type ApiErrorDetail } from "@/schemas";

import {
  createReviewResultSchema,
  submitForReviewResultSchema,
  type CreateReviewResult,
  type SubmitForReviewResult,
} from "./review-contract";
import {
  toReviewFields,
  type ReviewDraft,
  type ReviewFormField,
} from "./review-form";

export type ReviewRequestKind = "network" | "http" | "parse";

const NOT_FOUND_MESSAGE = "Analysis not found.";
const INVALID_STATE_MESSAGE = "This analysis is no longer in that state.";
const SUBMIT_ERROR = "Could not submit the analysis.";
const REVIEW_ERROR = "Could not save the review.";

const REVIEW_FIELDS = new Set<ReviewFormField>(["decision", "comment"]);

/**
 * A review action that was not recorded.
 * `network` means `fetch` threw. `http` is any non-2xx status.
 * `parse` means the body was not the 201 schema.
 */
export class ReviewRequestError extends Error {
  readonly kind: ReviewRequestKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly details: readonly ApiErrorDetail[];

  constructor(
    message: string,
    options: {
      kind: ReviewRequestKind;
      status?: number | null;
      code?: string | null;
      details?: readonly ApiErrorDetail[];
      cause?: unknown;
    },
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "ReviewRequestError";
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.details = options.details ?? [];
  }
}

export type ReviewRequestProblems = {
  message: string | null;
  fields: Partial<Record<ReviewFormField, string>>;
  refresh: boolean;
};

/**
 * 409 `invalid_state` reloads the page. 404 is not found.
 * A 400 detail on `decision` or `comment` is that field. Anything else is generic.
 */
export function reviewRequestProblems(
  error: ReviewRequestError,
  generic: string,
): ReviewRequestProblems {
  if (error.status === 409 && error.code === "invalid_state") {
    return { message: INVALID_STATE_MESSAGE, fields: {}, refresh: true };
  }

  if (
    error.status === 404 &&
    (error.code === "not_found" || error.code === null)
  ) {
    return { message: NOT_FOUND_MESSAGE, fields: {}, refresh: false };
  }

  if (error.status === 400) {
    const fields: Partial<Record<ReviewFormField, string>> = {};
    for (const detail of error.details) {
      if (isReviewField(detail.path) && !fields[detail.path]) {
        fields[detail.path] = detail.message;
      }
    }
    if (Object.keys(fields).length > 0) {
      return { message: null, fields, refresh: false };
    }
  }

  return { message: generic, fields: {}, refresh: false };
}

export function submitRequestProblems(
  error: ReviewRequestError,
): ReviewRequestProblems {
  const problems = reviewRequestProblems(error, SUBMIT_ERROR);
  return { ...problems, fields: {} };
}

export function createReviewProblems(
  error: ReviewRequestError,
): ReviewRequestProblems {
  return reviewRequestProblems(error, REVIEW_ERROR);
}

function isReviewField(path: string): path is ReviewFormField {
  return REVIEW_FIELDS.has(path as ReviewFormField);
}

function readErrorBody(payload: unknown): {
  code: string | null;
  details: ApiErrorDetail[];
} {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return { code: null, details: [] };
  }
  const error = payload.error;
  if (!error || typeof error !== "object") {
    return { code: null, details: [] };
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : null;
  const details =
    "details" in error
      ? apiErrorDetailSchema.array().safeParse(error.details)
      : null;

  return {
    code,
    details: details?.success ? details.data : [],
  };
}

async function errorFromResponse(
  response: Response,
  generic: string,
): Promise<ReviewRequestError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return new ReviewRequestError(
      response.status === 404 ? NOT_FOUND_MESSAGE : generic,
      { kind: "http", status: response.status },
    );
  }

  const body = readErrorBody(payload);
  const notFound = response.status === 404 && body.code === "not_found";
  const invalidState = response.status === 409 && body.code === "invalid_state";
  return new ReviewRequestError(
    notFound
      ? NOT_FOUND_MESSAGE
      : invalidState
        ? INVALID_STATE_MESSAGE
        : generic,
    {
      kind: "http",
      status: response.status,
      code: body.code,
      details: body.details,
    },
  );
}

async function postJson(
  path: string,
  body: unknown,
  generic: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [ORG_ID_HEADER]: orgId(),
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new ReviewRequestError(generic, { kind: "network", cause });
  }

  if (!response.ok) {
    throw await errorFromResponse(response, generic);
  }

  try {
    return await response.json();
  } catch (cause) {
    throw new ReviewRequestError(generic, {
      kind: "parse",
      status: response.status,
      cause,
    });
  }
}

/**
 * POST /api/analyses/[id]/submit with `x-org-id` and an empty JSON body.
 * Demo mode returns a local 201 and does not call `fetch`.
 */
export async function submitForReview(
  analysisId: string,
): Promise<SubmitForReviewResult> {
  if (isDemoData()) {
    return submitForReviewResultSchema.parse({
      id: analysisId,
      status: "in_review",
    });
  }

  const payload = await postJson(
    `/api/analyses/${encodeURIComponent(analysisId)}/submit`,
    {},
    SUBMIT_ERROR,
  );
  const parsed = submitForReviewResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ReviewRequestError(SUBMIT_ERROR, {
      kind: "parse",
      status: 201,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/**
 * POST /api/analyses/[id]/reviews with the review body and `x-org-id`.
 * Demo mode returns a local 201 and does not call `fetch`.
 */
export async function createReview(
  analysisId: string,
  draft: ReviewDraft,
): Promise<CreateReviewResult> {
  const fields = toReviewFields(draft);

  if (isDemoData()) {
    return createReviewResultSchema.parse({
      id: crypto.randomUUID(),
      analysisId,
      decision: fields.decision,
      comment: fields.comment,
      createdAt: new Date().toISOString(),
    });
  }

  const payload = await postJson(
    `/api/analyses/${encodeURIComponent(analysisId)}/reviews`,
    fields,
    REVIEW_ERROR,
  );
  const parsed = createReviewResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ReviewRequestError(REVIEW_ERROR, {
      kind: "parse",
      status: 201,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

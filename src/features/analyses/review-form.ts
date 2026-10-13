import type { AnalysisDbStatus } from "@/schemas";

import {
  reviewCreateBodySchema,
  reviewDecisionSchema,
  type ReviewCreateBody,
  type ReviewDecision,
} from "./review-contract";

const SUBMIT_STATUSES = [
  "draft",
  "in_progress",
  "changes_requested",
] as const satisfies readonly AnalysisDbStatus[];

export const REVIEW_DECISION_OPTIONS = reviewDecisionSchema.options;

export const REVIEW_DECISION_LABEL = {
  approved: "Approved",
  changes_requested: "Changes requested",
} as const satisfies Record<ReviewDecision, string>;

export type ReviewDraft = {
  decision: string;
  comment: string;
};

export type ReviewFormField = keyof ReviewDraft;

/** Submit for review is offered while the analysis is still with the author. */
export function showSubmitForReview(status: AnalysisDbStatus): boolean {
  return (SUBMIT_STATUSES as readonly AnalysisDbStatus[]).includes(status);
}

/** The decision form is offered only while a review is open. */
export function showReviewForm(status: AnalysisDbStatus): boolean {
  return status === "in_review";
}

function bodyFromDraft(draft: ReviewDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const decision = draft.decision.trim();
  const comment = draft.comment.trim();
  if (decision) {
    body.decision = decision;
  }
  if (comment) {
    body.comment = comment;
  }
  return body;
}

function messageFor(field: ReviewFormField, draft: ReviewDraft): string {
  if (field === "decision") {
    return "Choose a decision.";
  }
  if (field === "comment") {
    return draft.comment.trim()
      ? "Comment is too long."
      : "A comment is required.";
  }
  return "Check this field.";
}

/**
 * Problems with a review draft, checked with `reviewCreateBodySchema`.
 * An empty object means the draft can be posted.
 */
export function reviewFormErrors(
  draft: ReviewDraft,
): Partial<Record<ReviewFormField, string>> {
  const parsed = reviewCreateBodySchema.safeParse(bodyFromDraft(draft));
  if (parsed.success) {
    return {};
  }

  const errors: Partial<Record<ReviewFormField, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (key !== "decision" && key !== "comment") {
      continue;
    }
    if (!errors[key]) {
      errors[key] = messageFor(key, draft);
    }
  }
  if (!draft.comment.trim() && !errors.comment) {
    errors.comment = "A comment is required.";
  }
  if (!draft.decision.trim() && !errors.decision) {
    errors.decision = "Choose a decision.";
  }
  return errors;
}

/** Parsed body for POST /api/analyses/[id]/reviews. Throws when the draft is invalid. */
export function toReviewFields(draft: ReviewDraft): ReviewCreateBody {
  return reviewCreateBodySchema.parse(bodyFromDraft(draft));
}

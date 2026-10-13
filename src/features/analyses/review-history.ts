import { z } from "zod";

import { idSchema, timestampSchema } from "@/schemas";

/** Decisions stored on `reviews.decision`, including ones the form does not post. */
export const reviewHistoryDecisionSchema = z.enum([
  "pending",
  "approved",
  "changes_requested",
  "rejected",
]);

export const reviewHistorySchema = z.strictObject({
  id: idSchema,
  analysisId: idSchema,
  decision: reviewHistoryDecisionSchema,
  comment: z.string().nullable(),
  createdAt: timestampSchema,
});

export type ReviewHistoryDecision = z.infer<typeof reviewHistoryDecisionSchema>;
export type ReviewHistory = z.infer<typeof reviewHistorySchema>;

export const REVIEW_HISTORY_LABEL = {
  pending: "Pending",
  approved: "Approved",
  changes_requested: "Changes requested",
  rejected: "Rejected",
} as const satisfies Record<ReviewHistoryDecision, string>;

export const REVIEW_HISTORY_TONE = {
  pending: "warn",
  approved: "ok",
  changes_requested: "accent",
  rejected: "accent",
} as const satisfies Record<ReviewHistoryDecision, "warn" | "ok" | "accent">;

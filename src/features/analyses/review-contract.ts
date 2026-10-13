import { z } from "zod";

import { idSchema, timestampSchema } from "@/schemas";

/**
 * Stand-in for the review HTTP contract.
 *
 * TODO: replace this module with
 * `import { reviewDecisionSchema, reviewCreateBodySchema, createReviewResultSchema, submitForReviewResultSchema } from "@/schemas"`
 * when `src/schemas/reviews.ts` exports those schemas.
 * The analysis id stays on the path. This body sends `decision` and `comment` only.
 */

const reviewCommentSchema = z.string().trim().min(1).max(5000);

/** Decisions the review form can post. */
export const reviewDecisionSchema = z.enum(["approved", "changes_requested"]);

/** JSON body for POST /api/analyses/[id]/reviews. */
export const reviewCreateBodySchema = z.strictObject({
  decision: reviewDecisionSchema,
  comment: reviewCommentSchema,
});

/** 201 body for POST /api/analyses/[id]/reviews. */
export const createReviewResultSchema = z.strictObject({
  id: idSchema,
  analysisId: idSchema,
  decision: reviewDecisionSchema,
  comment: reviewCommentSchema,
  createdAt: timestampSchema,
});

/** 201 body for POST /api/analyses/[id]/submit. */
export const submitForReviewResultSchema = z.strictObject({
  id: idSchema,
  status: z.literal("in_review"),
});

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type ReviewCreateBody = z.infer<typeof reviewCreateBodySchema>;
export type CreateReviewResult = z.infer<typeof createReviewResultSchema>;
export type SubmitForReviewResult = z.infer<typeof submitForReviewResultSchema>;

import { z } from "zod";

import { idSchema, shortTextSchema, timestampSchema } from "./common";

export const reviewDecisionSchema = z.enum([
  "approved",
  "changes_requested",
  "rejected",
]);

/** Approval decision for an engineering analysis. */
export const reviewCreateSchema = z.object({
  analysisId: idSchema,
  decision: reviewDecisionSchema,
  comments: z.string().trim().max(5000).optional(),
  reviewer: shortTextSchema,
});

export const reviewSchema = reviewCreateSchema.extend({
  id: idSchema,
  createdAt: timestampSchema,
});

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type ReviewCreate = z.infer<typeof reviewCreateSchema>;
export type Review = z.infer<typeof reviewSchema>;

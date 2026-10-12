import { z } from "zod";

import {
  idSchema,
  longTextSchema,
  shortTextSchema,
  timestampSchema,
} from "./common";

/** Engineering judgment of whether the repair holds under load. */
export const analysisConclusionSchema = z.enum([
  "adequate",
  "inadequate",
  "inconclusive",
]);

/**
 * Stress and strength write-up for a repair. Review and approval
 * happen on a separate review record.
 */
export const analysisCreateSchema = z.object({
  repairId: idSchema,
  stressSummary: longTextSchema,
  strengthSummary: longTextSchema,
  conclusion: analysisConclusionSchema,
  analyst: shortTextSchema,
});

export const analysisSchema = analysisCreateSchema.extend({
  id: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type AnalysisConclusion = z.infer<typeof analysisConclusionSchema>;
export type AnalysisCreate = z.infer<typeof analysisCreateSchema>;
export type Analysis = z.infer<typeof analysisSchema>;

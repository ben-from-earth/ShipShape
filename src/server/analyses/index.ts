import "server-only";

import { analysisCreateSchema, type AnalysisCreate } from "@/schemas";

/**
 * Generic fields for opening an analysis. Callers pass untrusted input.
 * `createAnalysis` in `src/features/analyses/write.ts` persists the row and
 * checks that the repair belongs to the organization.
 */
export function parseAnalysisCreate(input: unknown): AnalysisCreate {
  return analysisCreateSchema.parse(input);
}

import "server-only";

import { analysisCreateSchema, type AnalysisCreate } from "@/schemas";

/**
 * Engineering stress and strength analysis for a repair.
 * Callers pass untrusted input; this parses it and returns the typed payload.
 * Persistence is added with the database schema.
 */
export function parseAnalysisCreate(input: unknown): AnalysisCreate {
  return analysisCreateSchema.parse(input);
}

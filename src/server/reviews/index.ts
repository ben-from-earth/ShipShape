import "server-only";

import { reviewCreateSchema, type ReviewCreate } from "@/schemas";

/**
 * Review and approval of an engineering analysis.
 * Callers pass untrusted input; this parses it and returns the typed payload.
 * Persistence is added with the database schema.
 */
export function parseReviewCreate(input: unknown): ReviewCreate {
  return reviewCreateSchema.parse(input);
}

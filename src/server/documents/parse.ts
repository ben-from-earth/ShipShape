import "server-only";

import { documentCreateSchema, type DocumentCreate } from "@/schemas";

/**
 * Callers pass untrusted input; this parses it and returns the typed payload.
 * Persistence is added with the database schema.
 */
export function parseDocumentCreate(input: unknown): DocumentCreate {
  return documentCreateSchema.parse(input);
}

import "server-only";

import { documentCreateSchema, type DocumentCreate } from "@/schemas";

/**
 * Uploaded reference documents.
 * Contextual search comes later: embed() will run all-MiniLM-L6-v2 locally
 * through Transformers.js (384 dimensions) and store vectors in pgvector.
 * Callers pass untrusted input; this parses it and returns the typed payload.
 */
export function parseDocumentCreate(input: unknown): DocumentCreate {
  return documentCreateSchema.parse(input);
}

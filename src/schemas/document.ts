import { z } from "zod";

import { idSchema, shortTextSchema, timestampSchema } from "./common";

/**
 * Local embedding contract for contextual document search.
 * A later change adds a single embed() function that runs
 * all-MiniLM-L6-v2 through Transformers.js. Vectors are 384-dimensional
 * and will be stored with pgvector on Neon. This module does not embed.
 */
export const DOCUMENT_EMBEDDING_MODEL = "all-MiniLM-L6-v2";
export const DOCUMENT_EMBEDDING_DIMENSIONS = 384;

/** An uploaded reference document, before any vector index exists. */
export const documentCreateSchema = z.object({
  title: shortTextSchema,
  storageKey: z.string().trim().min(1).max(500),
  mediaType: z.string().trim().min(1).max(100),
  uploadedBy: shortTextSchema,
});

export const documentSchema = documentCreateSchema.extend({
  id: idSchema,
  createdAt: timestampSchema,
});

export type DocumentCreate = z.infer<typeof documentCreateSchema>;
export type Document = z.infer<typeof documentSchema>;

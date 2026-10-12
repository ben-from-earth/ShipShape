import { z } from "zod";

import { idSchema, shortTextSchema, timestampSchema } from "./common";

/**
 * Storage contract for contextual document search.
 * embed() in src/server/documents produces these vectors. That module is
 * the only place that loads the model. pgvector storage is separate.
 */
export const DOCUMENT_EMBEDDING_MODEL = "all-MiniLM-L6-v2";
export const DOCUMENT_EMBEDDING_DIMENSIONS = 384;

/** An uploaded reference document. Chunks and embeddings live on document_chunks. */
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

/**
 * Response from POST /api/documents. The file is indexed before this is
 * returned, so status is indexed and at least one chunk was stored.
 */
export const documentUploadResultSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  title: shortTextSchema,
  mediaType: z.string().trim().min(1).max(100),
  storageKey: z.string().trim().min(1).max(500),
  status: z.literal("indexed"),
  chunkCount: z.number().int().positive(),
});

export type DocumentCreate = z.infer<typeof documentCreateSchema>;
export type Document = z.infer<typeof documentSchema>;
export type DocumentUploadResult = z.infer<typeof documentUploadResultSchema>;

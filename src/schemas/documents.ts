import { z } from "zod";

import { idSchema } from "./common";
import { DOCUMENT_EMBEDDING_DIMENSIONS } from "./document";

/**
 * One overlapping piece of extracted document text.
 *
 * Offsets are UTF-16 indexes into the extracted text: newlines are
 * normalized, and PDF pages are joined with a blank line. `text` is
 * exactly that slice. `pageStart` and `pageEnd` are 1-based and set
 * together for paged formats; both are null when the format has no pages.
 */
export const documentChunkSchema = z
  .object({
    index: z.number().int().nonnegative(),
    text: z.string().min(1),
    startOffset: z.number().int().nonnegative(),
    endOffset: z.number().int().nonnegative(),
    pageStart: z.number().int().positive().nullable(),
    pageEnd: z.number().int().positive().nullable(),
  })
  .superRefine((chunk, ctx) => {
    if (chunk.endOffset < chunk.startOffset) {
      ctx.addIssue({
        code: "custom",
        path: ["endOffset"],
        message: "endOffset must be greater than or equal to startOffset",
      });
    }

    if ((chunk.pageStart === null) !== (chunk.pageEnd === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["pageEnd"],
        message: "pageStart and pageEnd must both be set or both be null",
      });
    }

    if (
      chunk.pageStart !== null &&
      chunk.pageEnd !== null &&
      chunk.pageEnd < chunk.pageStart
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["pageEnd"],
        message: "pageEnd must be greater than or equal to pageStart",
      });
    }
  });

/** A normalized embedding produced for document search. */
export const documentEmbeddingSchema = z
  .array(z.number().finite())
  .length(DOCUMENT_EMBEDDING_DIMENSIONS);

/**
 * A contextual search over embedded chunks.
 * The database query and the HTTP route are separate from this shape.
 */
export const documentSearchQuerySchema = z.object({
  query: z.string().trim().min(1).max(2_000),
  limit: z.number().int().min(1).max(50).optional(),
  documentId: idSchema.optional(),
});

/**
 * One ranked chunk. `score` is cosine similarity of normalized embeddings,
 * so it falls between -1 and 1.
 *
 * `documentTitle` names the source document. `snippet` is a short,
 * human-readable excerpt of the matched chunk, suitable for displaying
 * in search results. The server derives it from `chunk.text`, trimmed to
 * roughly 300 characters on word boundaries.
 */
export const documentSearchHitSchema = z.object({
  documentId: idSchema,
  documentTitle: z.string().min(1),
  chunk: documentChunkSchema,
  snippet: z.string().min(1),
  score: z.number().min(-1).max(1),
});

export const documentSearchResultSchema = z.object({
  query: z.string().min(1),
  hits: z.array(documentSearchHitSchema),
});

export type DocumentChunk = z.infer<typeof documentChunkSchema>;
export type DocumentEmbedding = z.infer<typeof documentEmbeddingSchema>;
export type DocumentSearchQuery = z.infer<typeof documentSearchQuerySchema>;
export type DocumentSearchHit = z.infer<typeof documentSearchHitSchema>;
export type DocumentSearchResult = z.infer<typeof documentSearchResultSchema>;

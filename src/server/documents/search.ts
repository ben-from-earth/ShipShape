import "server-only";

import { and, cosineDistance, eq, sql, type SQL } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { getDb } from "@/db";
import { documentChunks, documents } from "@/db/schema";
import {
  documentEmbeddingSchema,
  documentSearchQuerySchema,
  documentSearchResultSchema,
  idSchema,
  type DocumentSearchResult,
} from "@/schemas";

import { embedText } from "./embed";
import { detailsFromZod, DocumentRequestError } from "./errors";
import { buildSnippet } from "./snippet";

export const DEFAULT_SEARCH_LIMIT = 10;

export type SimilarChunkQuery = {
  orgId: string;
  embedding: number[];
  documentId?: string;
  limit: number;
};

export type SimilarChunkRow = {
  documentId: string;
  documentTitle: string;
  index: number;
  text: string;
  startOffset: number | null;
  endOffset: number | null;
  pageStart: number | null;
  pageEnd: number | null;
  distance: number;
};

export type SearchDependencies = {
  embedQuery: (query: string) => Promise<number[]>;
  findSimilarChunks: (query: SimilarChunkQuery) => Promise<SimilarChunkRow[]>;
};

type ChunkSearchDb = Pick<PgDatabase<PgQueryResultHKT>, "select">;

/**
 * Embed the query and return the nearest chunks in one organization.
 * Score is cosine similarity: 1 - pgvector cosine distance.
 */
export async function searchDocuments(
  input: {
    orgId: string;
    query: string;
    limit?: number;
    documentId?: string;
  },
  dependencies: SearchDependencies = defaultDependencies(),
): Promise<DocumentSearchResult> {
  const orgId = idSchema.safeParse(input.orgId);
  if (!orgId.success) {
    throw new DocumentRequestError(
      "validation_error",
      "orgId must be a UUID.",
      [
        {
          path: "orgId",
          message: detailsFromZod(orgId.error)[0]?.message ?? "Invalid org id",
        },
      ],
    );
  }

  const parsed = documentSearchQuerySchema.safeParse({
    query: input.query,
    limit: input.limit,
    documentId: input.documentId,
  });
  if (!parsed.success) {
    throw new DocumentRequestError(
      "validation_error",
      "Request validation failed.",
      detailsFromZod(parsed.error),
    );
  }

  const limit = parsed.data.limit ?? DEFAULT_SEARCH_LIMIT;
  const embedding = documentEmbeddingSchema.parse(
    await dependencies.embedQuery(parsed.data.query),
  );

  const rows = await dependencies.findSimilarChunks({
    orgId: orgId.data,
    embedding,
    documentId: parsed.data.documentId,
    limit,
  });

  const hits = rows.slice(0, limit).map((row) => {
    const distance = readDistance(row.distance);
    const text = row.text;
    const snippet = buildSnippet(text);
    const pages = pageSpan(row.pageStart, row.pageEnd);

    return {
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      snippet,
      score: clampScore(1 - distance),
      chunk: {
        index: row.index,
        text,
        ...offsets(row.startOffset, row.endOffset, text.length),
        ...pages,
      },
    };
  });

  return documentSearchResultSchema.parse({
    query: parsed.data.query,
    hits,
  });
}

/**
 * Cosine-distance query shared by Neon and the pgvector integration test.
 * `cosineDistance` JSON-encodes an array without a cast. pgvector only
 * assigns text to `vector` on insert, so the `<=>` operand is cast with
 * `::vector` by passing an SQL fragment instead of a bare array.
 */
export function selectSimilarChunks(
  db: ChunkSearchDb,
  args: SimilarChunkQuery,
) {
  const distance = distanceTo(args.embedding);

  return db
    .select({
      documentId: documentChunks.documentId,
      documentTitle: documents.title,
      index: documentChunks.index,
      text: documentChunks.text,
      startOffset: documentChunks.startOffset,
      endOffset: documentChunks.endOffset,
      pageStart: documentChunks.pageStart,
      pageEnd: documentChunks.pageEnd,
      distance: distance.mapWith(Number),
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(
      and(
        eq(documents.orgId, args.orgId),
        args.documentId
          ? eq(documentChunks.documentId, args.documentId)
          : undefined,
      ),
    )
    .orderBy(distanceTo(args.embedding))
    .limit(args.limit);
}

export async function querySimilarChunks(
  db: ChunkSearchDb,
  args: SimilarChunkQuery,
): Promise<SimilarChunkRow[]> {
  const rows = await selectSimilarChunks(db, args);
  return rows.map((row) => ({
    documentId: row.documentId,
    documentTitle: row.documentTitle,
    index: row.index,
    text: row.text,
    startOffset: row.startOffset,
    endOffset: row.endOffset,
    pageStart: row.pageStart,
    pageEnd: row.pageEnd,
    distance: row.distance,
  }));
}

function defaultDependencies(): SearchDependencies {
  const db = getDb();
  return {
    embedQuery: embedText,
    findSimilarChunks: (query) => querySimilarChunks(db, query),
  };
}

function distanceTo(embedding: number[]): SQL {
  if (embedding.some((value) => !Number.isFinite(value))) {
    throw new Error("Search embedding contains a non-finite number");
  }

  const vector = sql`${JSON.stringify(embedding)}::vector`;
  return cosineDistance(documentChunks.embedding, vector as unknown as string);
}

function readDistance(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    throw new Error("Search returned an empty distance");
  }

  const distance = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(distance)) {
    throw new Error("Search returned a non-finite distance");
  }
  return distance;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    throw new Error("Search returned a non-finite score");
  }
  if (score > 1) {
    return 1;
  }
  if (score < -1) {
    return -1;
  }
  return score;
}

function pageSpan(
  start: number | null,
  end: number | null,
): { pageStart: number | null; pageEnd: number | null } {
  if (start === null || end === null || end < start || start < 1) {
    return { pageStart: null, pageEnd: null };
  }
  return { pageStart: start, pageEnd: end };
}

function offsets(
  start: number | null,
  end: number | null,
  textLength: number,
): { startOffset: number; endOffset: number } {
  if (start === null || end === null || end < start) {
    return { startOffset: 0, endOffset: textLength };
  }
  return { startOffset: start, endOffset: end };
}

import "server-only";

import { and, cosineDistance, eq, inArray, sql, type SQL } from "drizzle-orm";
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

type StatementDb = ChunkSearchDb & {
  execute: (query: SQL) => Promise<unknown>;
};

type BatchDb = StatementDb & {
  batch: (queries: readonly unknown[]) => Promise<unknown[]>;
};

type TransactionDb = StatementDb & {
  transaction: <T>(run: (tx: StatementDb) => Promise<T>) => Promise<T>;
};

/** pgvector >= 0.8. Must run in the same transaction as the nearest-neighbor query. */
const iterativeScan = sql`SET LOCAL hnsw.iterative_scan = relaxed_order`;

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

  const rows = sortByDistance(
    await dependencies.findSimilarChunks({
      orgId: orgId.data,
      embedding,
      documentId: parsed.data.documentId,
      limit,
    }),
  );

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
 *
 * The organization filter is a `document_id` predicate on `document_chunks`
 * so the HNSW scan can see it. Iterative scan then keeps walking until
 * `limit` rows match. The outer query sorts by that distance because
 * `relaxed_order` is not strict.
 */
export function selectSimilarChunks(
  db: ChunkSearchDb,
  args: SimilarChunkQuery,
) {
  const distance = distanceTo(args.embedding);
  const orgDocuments = db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, args.orgId),
        args.documentId ? eq(documents.id, args.documentId) : undefined,
      ),
    );

  const matches = db
    .select({
      documentId: documentChunks.documentId,
      index: documentChunks.index,
      text: documentChunks.text,
      startOffset: documentChunks.startOffset,
      endOffset: documentChunks.endOffset,
      pageStart: documentChunks.pageStart,
      pageEnd: documentChunks.pageEnd,
      distance: distance.mapWith(Number).as("distance"),
    })
    .from(documentChunks)
    .where(inArray(documentChunks.documentId, orgDocuments))
    .orderBy(distance)
    .limit(args.limit)
    .as("matches");

  return db
    .select({
      documentId: matches.documentId,
      documentTitle: documents.title,
      index: matches.index,
      text: matches.text,
      startOffset: matches.startOffset,
      endOffset: matches.endOffset,
      pageStart: matches.pageStart,
      pageEnd: matches.pageEnd,
      distance: matches.distance,
    })
    .from(matches)
    .innerJoin(documents, eq(matches.documentId, documents.id))
    .orderBy(matches.distance);
}

export async function querySimilarChunks(
  db: StatementDb,
  args: SimilarChunkQuery,
): Promise<SimilarChunkRow[]> {
  const rows = await readSimilarChunks(db, args);
  return sortByDistance(rows);
}

/**
 * An org filter on an HNSW index scan stops early and can return fewer
 * than `limit` rows. relaxed_order keeps scanning until the limit is
 * filled, then we sort because that mode is not strictly ordered.
 *
 * Neon HTTP exposes batch and a transaction method that throws.
 * node-postgres exposes transaction. Prefer batch when it exists so the
 * Neon client does not hit that throw.
 */
async function readSimilarChunks(
  db: StatementDb,
  args: SimilarChunkQuery,
): Promise<SimilarChunkRow[]> {
  const batchDb = asBatchDb(db);
  if (batchDb) {
    const results = await batchDb.batch([
      batchDb.execute(iterativeScan),
      selectSimilarChunks(batchDb, args),
    ]);
    return asChunkRows(results[1]);
  }

  const transactionDb = asTransactionDb(db);
  if (transactionDb) {
    const rows = await transactionDb.transaction(async (tx) => {
      await tx.execute(iterativeScan);
      return selectSimilarChunks(tx, args);
    });
    return asChunkRows(rows);
  }

  throw new Error(
    "Document search needs a database that can run SET LOCAL in a transaction",
  );
}

function asBatchDb(db: StatementDb): BatchDb | undefined {
  const candidate = db as StatementDb & { batch?: unknown };
  if (typeof candidate.batch !== "function") {
    return undefined;
  }
  return candidate as BatchDb;
}

function asTransactionDb(db: StatementDb): TransactionDb | undefined {
  const candidate = db as StatementDb & { transaction?: unknown };
  if (typeof candidate.transaction !== "function") {
    return undefined;
  }
  return candidate as TransactionDb;
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

function sortByDistance(rows: readonly SimilarChunkRow[]): SimilarChunkRow[] {
  return [...rows].sort(
    (left, right) => readDistance(left.distance) - readDistance(right.distance),
  );
}

function asChunkRows(value: unknown): SimilarChunkRow[] {
  if (!Array.isArray(value)) {
    throw new Error("Search returned an unexpected result");
  }
  return value as SimilarChunkRow[];
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

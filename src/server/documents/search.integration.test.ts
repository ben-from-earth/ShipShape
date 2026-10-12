import { drizzle } from "drizzle-orm/node-postgres";
import { inArray } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { documentChunks, documents, organizations } from "@/db/schema";
import { DOCUMENT_EMBEDDING_DIMENSIONS } from "@/schemas";

import {
  querySimilarChunks,
  searchDocuments,
  type SimilarChunkQuery,
} from "./search";
import { buildSnippet, SNIPPET_MAX_CHARACTERS } from "./snippet";

const databaseUrl = readIntegrationUrl();

describe.skipIf(!databaseUrl)("document search against pgvector", () => {
  const orgA = "550e8400-e29b-41d4-a716-4466554400a1";
  const orgB = "550e8400-e29b-41d4-a716-4466554400b2";
  const nearId = "550e8400-e29b-41d4-a716-4466554400c3";
  const farId = "550e8400-e29b-41d4-a716-4466554400d4";
  const otherOrgId = "550e8400-e29b-41d4-a716-4466554400e5";
  const nearText = `${"rivet ".repeat(80)}crack along the weld`;

  let pool: Pool | undefined;
  let db: ReturnType<typeof drizzle> | undefined;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    db = drizzle(pool);
    const database = db;

    await database.insert(organizations).values([
      { id: orgA, name: "Integration A" },
      { id: orgB, name: "Integration B" },
    ]);
    await database.insert(documents).values([
      {
        id: nearId,
        orgId: orgA,
        title: "Hull inspection notes",
        storageKey: `${orgA}/${nearId}`,
        mimeType: "text/plain",
        status: "indexed",
      },
      {
        id: farId,
        orgId: orgA,
        title: "Unrelated procedure",
        storageKey: `${orgA}/${farId}`,
        mimeType: "text/plain",
        status: "indexed",
      },
      {
        id: otherOrgId,
        orgId: orgB,
        title: "Other organization",
        storageKey: `${orgB}/${otherOrgId}`,
        mimeType: "text/plain",
        status: "indexed",
      },
    ]);
    await database.insert(documentChunks).values([
      {
        documentId: nearId,
        index: 0,
        text: nearText,
        startOffset: 0,
        endOffset: nearText.length,
        pageStart: 2,
        pageEnd: 3,
        embedding: axis(0),
      },
      {
        documentId: farId,
        index: 0,
        text: "A procedure that does not match the query.",
        startOffset: 0,
        endOffset: 42,
        pageStart: null,
        pageEnd: null,
        embedding: axis(1),
      },
      {
        documentId: otherOrgId,
        index: 0,
        text: nearText,
        startOffset: 0,
        endOffset: nearText.length,
        pageStart: 1,
        pageEnd: 1,
        embedding: axis(0),
      },
    ]);
  });

  afterAll(async () => {
    if (db) {
      await db.delete(documents).where(inArray(documents.orgId, [orgA, orgB]));
      await db
        .delete(organizations)
        .where(inArray(organizations.id, [orgA, orgB]));
    }
    await pool?.end();
  });

  it("ranks the nearest chunk in the organization and builds a snippet", async () => {
    const database = requiredDb();
    const result = await searchDocuments(
      { orgId: orgA, query: "crack along the weld", limit: 10 },
      {
        embedQuery: async () => axis(0),
        findSimilarChunks: (query) =>
          querySimilarChunks(database as ChunkSearchDb, query),
      },
    );

    expect(result.hits.map((hit) => hit.documentId)).toEqual([nearId, farId]);
    expect(result.hits[0]?.documentTitle).toBe("Hull inspection notes");
    expect(result.hits[0]?.score).toBeCloseTo(1, 5);
    expect(result.hits[1]?.score).toBeCloseTo(0, 5);
    expect(result.hits[0]?.chunk.pageStart).toBe(2);
    expect(result.hits[0]?.chunk.pageEnd).toBe(3);
    expect(result.hits[0]?.snippet.length).toBeLessThanOrEqual(
      SNIPPET_MAX_CHARACTERS,
    );
    expect(result.hits[0]?.snippet).toBe(buildSnippet(nearText));
  });

  it("filters by document and does not cross organizations", async () => {
    const database = requiredDb();
    const finder = (query: SimilarChunkQuery) =>
      querySimilarChunks(database as ChunkSearchDb, query);

    const filtered = await searchDocuments(
      { orgId: orgA, query: "weld", documentId: farId },
      { embedQuery: async () => axis(0), findSimilarChunks: finder },
    );
    const otherOrg = await searchDocuments(
      { orgId: orgB, query: "weld" },
      { embedQuery: async () => axis(0), findSimilarChunks: finder },
    );

    expect(filtered.hits.map((hit) => hit.documentId)).toEqual([farId]);
    expect(otherOrg.hits.map((hit) => hit.documentId)).toEqual([otherOrgId]);
    expect(otherOrg.hits[0]?.score).toBeCloseTo(1, 5);
  });

  function requiredDb() {
    if (!db) {
      throw new Error("Integration database was not opened");
    }
    return db;
  }
});

type ChunkSearchDb = Parameters<typeof querySimilarChunks>[0];

function axis(index: number): number[] {
  const values = Array.from({ length: DOCUMENT_EMBEDDING_DIMENSIONS }, () => 0);
  const slot = values[index];
  if (slot === undefined) {
    throw new Error("Embedding axis is out of range");
  }
  values[index] = 1;
  return values;
}

function readIntegrationUrl(): string | undefined {
  const url = process.env.SHIPSHAPE_INTEGRATION_DATABASE_URL;
  if (process.env.REQUIRE_PGVECTOR_INTEGRATION === "1" && !url) {
    throw new Error(
      "SHIPSHAPE_INTEGRATION_DATABASE_URL is required for the pgvector integration test.",
    );
  }
  if (!url) {
    return undefined;
  }

  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error("SHIPSHAPE_INTEGRATION_DATABASE_URL is not a valid URL.");
  }
  if (hostname === "neon.tech" || hostname.endsWith(".neon.tech")) {
    throw new Error(
      "Refusing to run document search integration tests against Neon.",
    );
  }
  return url;
}

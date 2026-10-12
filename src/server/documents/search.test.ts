import { drizzle } from "drizzle-orm/neon-http";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import { DOCUMENT_EMBEDDING_DIMENSIONS } from "@/schemas";

import { buildSnippet, SNIPPET_MAX_CHARACTERS } from "./snippet";
import {
  querySimilarChunks,
  searchDocuments,
  selectSimilarChunks,
  type SearchDependencies,
  type SimilarChunkRow,
} from "./search";

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const documentId = "550e8400-e29b-41d4-a716-446655440010";

function vector(): number[] {
  return Array.from({ length: DOCUMENT_EMBEDDING_DIMENSIONS }, () => 0.2);
}

function row(overrides: Partial<SimilarChunkRow> = {}): SimilarChunkRow {
  const text = overrides.text ?? "Bent support near the access hatch.";
  return {
    documentId,
    documentTitle: "Hull inspection notes",
    index: 0,
    text,
    startOffset: 0,
    endOffset: text.length,
    pageStart: 1,
    pageEnd: 2,
    distance: 0.25,
    ...overrides,
  };
}

function dependencies(
  rows: SimilarChunkRow[] = [row()],
): SearchDependencies & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    embedQuery: vi.fn(async () => vector()),
    findSimilarChunks: vi.fn(async (query) => {
      calls.push(query);
      return rows;
    }),
  };
}

describe("buildSnippet", () => {
  it("trims to a word boundary near 300 characters", () => {
    const text = Array.from({ length: 80 }, (_, index) => `word${index}`).join(
      " ",
    );
    const snippet = buildSnippet(text);

    expect(snippet.length).toBeLessThanOrEqual(SNIPPET_MAX_CHARACTERS);
    expect(snippet.length).toBeGreaterThan(0);
    expect(text.startsWith(snippet)).toBe(true);
    expect(text[snippet.length]).toBe(" ");
  });

  it("keeps a short chunk and cuts a single long word at the limit", () => {
    expect(buildSnippet("  hatch\nplate  ")).toBe("hatch plate");
    const word = "a".repeat(SNIPPET_MAX_CHARACTERS + 20);
    expect(buildSnippet(word)).toHaveLength(SNIPPET_MAX_CHARACTERS);
  });
});

describe("searchDocuments", () => {
  it("scores cosine similarity and keeps the database order", async () => {
    const long = `${"rivet ".repeat(80)}end`;
    const deps = dependencies([
      row({ distance: 0.2, documentTitle: "Near", text: long }),
      row({
        distance: 0.5,
        documentTitle: "Far",
        documentId: "550e8400-e29b-41d4-a716-446655440011",
        text: "orthogonal chunk",
      }),
    ]);

    const result = await searchDocuments(
      { orgId, query: "  hatches  ", limit: 4, documentId },
      deps,
    );

    expect(deps.embedQuery).toHaveBeenCalledWith("hatches");
    expect(deps.calls[0]).toMatchObject({
      orgId,
      documentId,
      limit: 4,
      embedding: vector(),
    });
    expect(result.query).toBe("hatches");
    expect(result.hits.map((hit) => hit.documentTitle)).toEqual([
      "Near",
      "Far",
    ]);
    expect(result.hits.map((hit) => hit.score)).toEqual([0.8, 0.5]);
    expect(result.hits[0]?.snippet.length).toBeLessThanOrEqual(
      SNIPPET_MAX_CHARACTERS,
    );
    expect(result.hits[0]?.snippet.endsWith(" ")).toBe(false);
    expect(result.hits[0]?.chunk.pageStart).toBe(1);
    expect(result.hits[0]?.chunk.pageEnd).toBe(2);
  });

  it("defaults the limit to 10 and clamps an out-of-range score", async () => {
    const deps = dependencies([row({ distance: -0.2 })]);

    const result = await searchDocuments({ orgId, query: "hatch" }, deps);

    expect(deps.calls[0]).toMatchObject({ limit: 10 });
    expect(result.hits[0]?.score).toBe(1);
  });

  it("re-sorts a relaxed scan so the nearest chunk is first", async () => {
    const deps = dependencies([
      row({ distance: 0.9, documentTitle: "Far" }),
      row({
        distance: 0.1,
        documentTitle: "Near",
        documentId: "550e8400-e29b-41d4-a716-446655440011",
      }),
    ]);

    const result = await searchDocuments({ orgId, query: "hatch" }, deps);

    expect(result.hits.map((hit) => hit.documentTitle)).toEqual([
      "Near",
      "Far",
    ]);
    expect(result.hits[0]?.score).toBeCloseTo(0.9);
    expect(result.hits[1]?.score).toBeCloseTo(0.1);
  });

  it("does not embed when the organization id is invalid", async () => {
    const deps = dependencies();

    await expect(
      searchDocuments({ orgId: "nope", query: "hatch" }, deps),
    ).rejects.toMatchObject({ status: 400, code: "validation_error" });
    expect(deps.embedQuery).not.toHaveBeenCalled();
  });
});

describe("selectSimilarChunks", () => {
  it("orders by cosine distance inside the organization", () => {
    const db = drizzle.mock({ schema });
    const compiled = selectSimilarChunks(db, {
      orgId,
      embedding: [1, 0, 0],
      documentId,
      limit: 5,
    }).toSQL();
    const sqlText = compiled.sql.toLowerCase();

    expect(sqlText).toContain("<=>");
    expect(compiled.sql).toContain("::vector");
    expect(compiled.sql).toContain("org_id");
    expect(compiled.sql).toContain("document_id");
    expect(sqlText).toContain("limit");
    expect(sqlText).not.toContain("desc");
    expect(sqlText).toMatch(/order by[\s\S]*<=>/);
    expect(compiled.params).toContain("[1,0,0]");
  });

  it("runs iterative scan in the same batch and sorts the rows", async () => {
    const db = drizzle.mock({ schema });
    const statements: string[] = [];
    const batch = vi.fn(async (queries: readonly object[]) => {
      for (const query of queries) {
        statements.push(statementSql(query));
      }
      return [
        [],
        [
          row({ distance: 0.8 }),
          row({ distance: 0.2, documentTitle: "Closer" }),
        ],
      ];
    });
    Object.assign(db, { batch });

    const rows = await querySimilarChunks(db, {
      orgId,
      embedding: [1, 0, 0],
      limit: 2,
    });

    expect(statements[0]?.toLowerCase()).toContain("hnsw.iterative_scan");
    expect(statements[0]?.toLowerCase()).toContain("relaxed_order");
    expect(statements[1]?.toLowerCase()).toContain("<=>");
    expect(batch).toHaveBeenCalledTimes(1);
    expect(rows.map((hit) => hit.distance)).toEqual([0.2, 0.8]);
    expect(rows[0]?.documentTitle).toBe("Closer");
  });

  it("runs iterative scan in a transaction when the driver has no batch", async () => {
    const db = drizzle.mock({ schema });
    const statements: string[] = [];
    const select = ((...args: Parameters<typeof db.select>) =>
      queryWithoutExecution(db.select(...args))) as unknown as typeof db.select;
    const tx = {
      execute(query: object) {
        statements.push(statementSql(query));
        return Promise.resolve(undefined);
      },
      select,
    };
    const database = {
      select,
      execute: db.execute.bind(db),
      transaction: async <T>(run: (inner: typeof tx) => Promise<T>) => run(tx),
    };

    const rows = await querySimilarChunks(database, {
      orgId,
      embedding: [1, 0, 0],
      limit: 2,
    });

    expect(statements[0]?.toLowerCase()).toContain("hnsw.iterative_scan");
    expect(statements[0]?.toLowerCase()).toContain("relaxed_order");
    expect(rows).toEqual([]);
  });
});

const pgDialect = new PgDialect();

/** Keep the query builder, but do not send the mock driver a statement. */
function queryWithoutExecution<T extends object>(builder: T): T {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "then") {
        return (resolve: (rows: unknown[]) => void) => resolve([]);
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") {
        return value;
      }
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        return result && typeof result === "object"
          ? queryWithoutExecution(result)
          : result;
      };
    },
  });
}

function statementSql(query: object): string {
  if ("toSQL" in query && typeof query.toSQL === "function") {
    return query.toSQL().sql;
  }
  if ("getQuery" in query && typeof query.getQuery === "function") {
    return query.getQuery().sql;
  }
  if ("getSQL" in query && typeof query.getSQL === "function") {
    return pgDialect.sqlToQuery(query.getSQL()).sql;
  }
  throw new Error("Query did not expose SQL");
}

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { getTableConfig } from "drizzle-orm/pg-core";
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from "drizzle-orm/relations";
import { describe, expect, it } from "vitest";

import { DOCUMENT_EMBEDDING_DIMENSIONS } from "@/schemas";

import * as relations from "./relations";
import {
  DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS,
  analyses,
  assets,
  documentChunks,
  issues,
  repairs,
} from "./schema";
import * as schema from "./schema";

describe("database schema", () => {
  it("stores normalized MiniLM embeddings in a cosine HNSW index", () => {
    expect(DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS).toBe(
      DOCUMENT_EMBEDDING_DIMENSIONS,
    );

    const config = getTableConfig(documentChunks);
    const embedding = config.columns.find(
      (column) => column.name === "embedding",
    );
    expect(embedding?.getSQLType()).toBe(
      `vector(${DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS})`,
    );

    const hnsw = config.indexes.find(
      (entry) => entry.config.name === "chunks_embedding_hnsw",
    );
    expect(hnsw?.config.method).toBe("hnsw");

    const indexed = hnsw?.config.columns[0];
    const opClass =
      indexed && "indexConfig" in indexed
        ? indexed.indexConfig?.opClass
        : undefined;
    expect(opClass).toBe("vector_cosine_ops");
  });

  it("stores nullable page span and character offsets", () => {
    const config = getTableConfig(documentChunks);

    for (const name of [
      "page_start",
      "page_end",
      "start_offset",
      "end_offset",
    ]) {
      const column = config.columns.find((entry) => entry.name === name);
      expect(column?.getSQLType()).toBe("integer");
      expect(column?.notNull).toBe(false);
    }
  });

  it("keeps issue, repair, and analysis codes unique", () => {
    const expected = [
      [issues, "issues_code_uq"],
      [repairs, "repairs_code_uq"],
      [analyses, "analyses_code_uq"],
    ] as const;

    for (const [table, name] of expected) {
      const unique = getTableConfig(table).indexes.find(
        (entry) => entry.config.name === name,
      );
      expect(unique?.config.unique).toBe(true);
    }
  });

  it("stores the out-of-service flag as a boolean", () => {
    const config = getTableConfig(assets);
    const flag = config.columns.find(
      (column) => column.name === "out_of_service",
    );

    expect(flag?.getSQLType()).toBe("boolean");
    expect(flag?.notNull).toBe(true);
  });

  it("registers every table with its relations", () => {
    const { tables } = extractTablesRelationalConfig(
      { ...schema, ...relations },
      createTableRelationsHelpers,
    );

    expect(Object.keys(tables).sort()).toEqual([
      "activityLog",
      "analyses",
      "analysisCases",
      "analysisPeople",
      "assetGroups",
      "assets",
      "documentChunks",
      "documents",
      "issueMedia",
      "issues",
      "organizations",
      "repairRevisions",
      "repairs",
      "reviews",
      "stageTransitions",
      "toolRuns",
      "users",
    ]);
  });

  it("enables pgvector before the rest of the initial migration", () => {
    const migrationsDir = path.join(process.cwd(), "migrations");
    const files = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const firstFile = files[0];
    if (firstFile === undefined) {
      throw new Error("expected an initial migration");
    }

    const sqlText = readFileSync(path.join(migrationsDir, firstFile), "utf8");
    const firstChunk = sqlText.split("--> statement-breakpoint")[0] ?? "";
    const firstStatement = firstChunk
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim();

    expect(firstStatement).toBe("CREATE EXTENSION IF NOT EXISTS vector;");
    expect(sqlText).toContain("vector(384)");
    expect(sqlText).toMatch(/USING hnsw/);
    expect(sqlText).toContain("vector_cosine_ops");
  });
});

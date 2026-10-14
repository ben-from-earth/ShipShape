import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { getTableConfig } from "drizzle-orm/pg-core";
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from "drizzle-orm/relations";
import { describe, expect, it } from "vitest";

import { REPAIR_STATUSES } from "@/config/repairs";
import { SEVERITIES } from "@/config/severity";
import { DOCUMENT_EMBEDDING_DIMENSIONS } from "@/schemas";

import * as relations from "./relations";
import {
  DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS,
  ISSUE_CODE_SEQUENCE_START,
  ANALYSIS_CODE_SEQUENCE_START,
  REPAIR_CODE_SEQUENCE_START,
  analyses,
  analysisCodeSeq,
  assets,
  documentChunks,
  issueCodeSeq,
  issueSeverity,
  issues,
  repairCodeSeq,
  repairStatus,
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

  it("starts the issue code sequence past the demo seed", () => {
    expect(issueCodeSeq.seqName).toBe("issue_code_seq");
    expect(issueCodeSeq.seqOptions?.startWith).toBe(ISSUE_CODE_SEQUENCE_START);
    expect(issueCodeSeq.seqOptions?.increment).toBe(1);
    expect(ISSUE_CODE_SEQUENCE_START).toBe(1002);
  });

  it("adds the issue code sequence without a destructive statement", () => {
    const migrationsDir = path.join(process.cwd(), "migrations");
    const sqlText = readFileSync(
      path.join(migrationsDir, "0001_issue_code_seq.sql"),
      "utf8",
    );

    expect(sqlText).toContain(
      'CREATE SEQUENCE "public"."issue_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1002 CACHE 1;',
    );
    expect(sqlText).toContain("SELECT setval(");
    expect(sqlText).toContain("1001::bigint");
    expect(sqlText).toContain("'^ISS-([0-9]+)$'");
    expect(sqlText).not.toMatch(/\bDROP\b/i);
    expect(sqlText).not.toMatch(/\bALTER TABLE\b/i);
  });

  it("requires issue severity from the shared list and stores no default", () => {
    expect(issueSeverity.enumName).toBe("issue_severity");
    expect(issueSeverity.enumValues).toEqual([...SEVERITIES]);
    expect("SEVERITIES" in schema).toBe(false);

    const column = getTableConfig(issues).columns.find(
      (entry) => entry.name === "severity",
    );
    expect(column?.getSQLType()).toBe("issue_severity");
    expect(column?.notNull).toBe(true);
    expect(column?.hasDefault).toBe(false);

    const sqlText = readFileSync(
      path.join(process.cwd(), "migrations", "0002_issue_severity.sql"),
      "utf8",
    );
    expect(sqlText).toContain(
      "CREATE TYPE \"public\".\"issue_severity\" AS ENUM('low', 'medium', 'high', 'critical');",
    );
    expect(sqlText).toContain(
      'ADD COLUMN "severity" "issue_severity" DEFAULT \'medium\' NOT NULL;',
    );
    expect(sqlText).toContain(
      'ALTER TABLE "issues" ALTER COLUMN "severity" DROP DEFAULT;',
    );
    expect(sqlText).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)\b/i);
  });

  it("indexes repairs by issue and shares the status list", () => {
    const config = getTableConfig(repairs);
    const byIssue = config.indexes.find(
      (entry) => entry.config.name === "repairs_issue_idx",
    );
    expect(byIssue?.config.unique).toBe(false);
    const indexed = byIssue?.config.columns[0];
    expect(indexed && "name" in indexed ? indexed.name : undefined).toBe(
      "issue_id",
    );
    expect([...repairStatus.enumValues]).toEqual([...REPAIR_STATUSES]);
    expect(repairCodeSeq.seqName).toBe("repair_code_seq");
    expect(REPAIR_CODE_SEQUENCE_START).toBe(1002);
  });

  it("indexes analyses by repair revision and allocates AN- codes", () => {
    const config = getTableConfig(analyses);
    const byRevision = config.indexes.find(
      (entry) => entry.config.name === "analyses_revision_idx",
    );
    expect(byRevision?.config.unique).toBe(false);
    const indexed = byRevision?.config.columns[0];
    expect(indexed && "name" in indexed ? indexed.name : undefined).toBe(
      "repair_revision_id",
    );
    expect(analysisCodeSeq.seqName).toBe("analysis_code_seq");
    expect(ANALYSIS_CODE_SEQUENCE_START).toBe(1002);

    const sqlText = readFileSync(
      path.join(process.cwd(), "migrations", "0004_analysis_codes.sql"),
      "utf8",
    );
    expect(sqlText).toContain(
      'CREATE SEQUENCE "public"."analysis_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1002 CACHE 1;',
    );
    expect(sqlText).toContain('ADD COLUMN "created_by" uuid;');
    expect(sqlText).toContain(
      'CREATE INDEX "analyses_revision_idx" ON "analyses" USING btree ("repair_revision_id");',
    );
    expect(sqlText).toContain("SELECT setval(");
    expect(sqlText).toContain("1001::bigint");
    expect(sqlText).toContain("'^[A-Za-z]+-([0-9]+)$'");
    expect(sqlText).toContain('FROM "analyses"');
    expect(sqlText).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)\b/i);
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
      "analysisAttachments",
      "analysisCases",
      "analysisComments",
      "analysisPeople",
      "assetGroups",
      "assets",
      "documentChunks",
      "documents",
      "engineeringAnalyses",
      "engineers",
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

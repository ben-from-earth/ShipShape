import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import { SEVERITIES } from "../config/severity";

/**
 * all-MiniLM-L6-v2 output width. Chunks store L2-normalized vectors and
 * the HNSW index uses cosine distance, which matches that normalization.
 * Keep this equal to DOCUMENT_EMBEDDING_DIMENSIONS in src/schemas/document.ts.
 *
 * Drizzle Kit does not emit CREATE EXTENSION. The initial migration starts
 * with `CREATE EXTENSION IF NOT EXISTS vector` so this column can be created.
 */
export const DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS = 384;

/** JSON value stored in a jsonb column. */
export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };

function id() {
  return uuid("id").primaryKey().defaultRandom();
}

/**
 * Row timestamps. `updated_at` defaults to now() in the database and Drizzle
 * refreshes it on update via $onUpdate. A raw SQL update does not.
 * Each call returns new column builders so tables do not share one instance.
 */
function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  };
}

function jsonObject(name: string) {
  return jsonb(name)
    .$type<Json>()
    .notNull()
    .default(sql`'{}'::jsonb`);
}

// ---------- Enums ----------

export const userRole = pgEnum("user_role", [
  "field_tech",
  "analyst",
  "checker",
  "approver",
  "admin",
]);

/** Lifecycle of one issue, from the field report through close. */
export const workStage = pgEnum("work_stage", [
  "discovered",
  "repair_defined",
  "analysis",
  "review",
  "approved",
  "closed",
]);

export const analysisStatus = pgEnum("analysis_status", [
  "draft",
  "in_progress",
  "in_review",
  "changes_requested",
  "approved",
]);

export const reviewDecision = pgEnum("review_decision", [
  "pending",
  "approved",
  "changes_requested",
  "rejected",
]);

export const docStatus = pgEnum("doc_status", [
  "uploaded",
  "processing",
  "indexed",
  "failed",
]);

/** Same list as `SEVERITIES` in src/config/severity.ts. */
export const issueSeverity = pgEnum("issue_severity", SEVERITIES);

// ---------- Organizations and people ----------

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  /** Margin at or below this value is flagged on the dashboard. */
  lowMarginThreshold: numeric("low_margin_threshold", {
    precision: 4,
    scale: 2,
  })
    .notNull()
    .default("0.10"),
  ...timestamps(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    initials: text("initials").notNull(),
    role: userRole("role").notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("users_email_uq").on(table.email)],
);

// ---------- Assets (domain-agnostic) ----------

/**
 * A named set of repairable things. `asset_type` is a free label
 * ("aircraft", "bridge", "pressure vessel"), not a closed list.
 */
export const assetGroups = pgTable("asset_groups", {
  id: id(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  assetType: text("asset_type"),
  ...timestamps(),
});

/**
 * One repairable thing. Identity is the organization's own identifier
 * (tail number, hull number, serial, structure id). Type-specific facts
 * live in `attributes`, not in dedicated columns.
 */
export const assets = pgTable(
  "assets",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    groupId: uuid("group_id").references(() => assetGroups.id),
    identifier: text("identifier").notNull(),
    name: text("name"),
    model: text("model"),
    attributes: jsonObject("attributes"),
    outOfService: boolean("out_of_service").notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("assets_org_identifier_uq").on(table.orgId, table.identifier),
  ],
);

// ---------- Workflow: issue -> repair -> analysis -> review ----------

/**
 * Allocates `issues.code`. The demo seed inserts `ISS-1001`, so the first
 * `nextval` is 1002 (`ISS-1002`). Migration 0001 also `setval`s the sequence
 * to the highest existing `ISS-` code so a database that already has rows
 * cannot collide.
 */
export const ISSUE_CODE_SEQUENCE_START = 1002;

export const issueCodeSeq = pgSequence("issue_code_seq", {
  startWith: ISSUE_CODE_SEQUENCE_START,
  increment: 1,
});

/**
 * Field report of damage. The product calls this a damage report; the row
 * stays one issue so stage history can follow it from discovery to close.
 * `code` is a global human id (`ISS-1001`). Allocate new values with
 * `nextIssueCode` in `src/db/issue-code.ts`, not by picking the next number
 * in application code.
 */
export const issues = pgTable(
  "issues",
  {
    id: id(),
    /** Human id shown in the UI. Unique across all organizations. */
    code: text("code").notNull(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => assets.id),
    /** Area used for "findings by zone". Meaning depends on the asset type. */
    zone: text("zone"),
    locationLabel: text("location_label"),
    /** Structured coordinates. Shape depends on the asset type. */
    location: jsonObject("location"),
    description: text("description").notNull(),
    /**
     * Required on insert. There is no database default: migration 0002
     * backfills existing rows with `medium`, then drops that default.
     */
    severity: issueSeverity("severity").notNull(),
    stage: workStage("stage").notNull().default("discovered"),
    reportedBy: uuid("reported_by").references(() => users.id),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("issues_code_uq").on(table.code),
    index("issues_asset_idx").on(table.assetId),
    index("issues_stage_idx").on(table.stage),
  ],
);

/** Photo or other file attached to an issue. Bytes live in object storage. */
export const issueMedia = pgTable("issue_media", {
  id: id(),
  issueId: uuid("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  caption: text("caption"),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  ...timestamps(),
});

export const repairs = pgTable(
  "repairs",
  {
    id: id(),
    /** Human id shown in the UI. Unique across all organizations. */
    code: text("code").notNull(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id),
    title: text("title").notNull(),
    /** Free label, for example "doubler" or "replacement". */
    type: text("type"),
    ...timestamps(),
  },
  (table) => [uniqueIndex("repairs_code_uq").on(table.code)],
);

export const repairRevisions = pgTable(
  "repair_revisions",
  {
    id: id(),
    repairId: uuid("repair_id")
      .notNull()
      .references(() => repairs.id, { onDelete: "cascade" }),
    /** Revision letter or number, for example "A" or "B". */
    rev: text("rev").notNull(),
    detail: text("detail"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (table) => [uniqueIndex("repair_rev_uq").on(table.repairId, table.rev)],
);

export const analyses = pgTable(
  "analyses",
  {
    id: id(),
    /** Human id shown in the UI. Unique across all organizations. */
    code: text("code").notNull(),
    repairRevisionId: uuid("repair_revision_id")
      .notNull()
      .references(() => repairRevisions.id),
    title: text("title").notNull(),
    method: text("method"),
    status: analysisStatus("status").notNull().default("draft"),
    ownerId: uuid("owner_id").references(() => users.id),
    dueDate: date("due_date"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("analyses_code_uq").on(table.code),
    index("analyses_status_idx").on(table.status),
    index("analyses_owner_idx").on(table.ownerId),
  ],
);

/**
 * People assigned to an analysis. The same person can hold more than one
 * role, so the primary key includes the role.
 */
export const analysisPeople = pgTable(
  "analysis_people",
  {
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => analyses.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: userRole("role").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.analysisId, table.userId, table.role],
    }),
  ],
);

/**
 * One margin-of-safety case. Dashboard minimum margin is MIN(margin)
 * per analysis.
 */
export const analysisCases = pgTable(
  "analysis_cases",
  {
    id: id(),
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => analyses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    margin: numeric("margin", { precision: 8, scale: 3 }).notNull(),
    ...timestamps(),
  },
  (table) => [index("analysis_cases_analysis_idx").on(table.analysisId)],
);

/**
 * A saved engineering-tool run (layer loads, lug, crack growth, and so on).
 * Inputs and outputs are versioned with `tool_version` so an old run stays
 * readable after the tool changes.
 */
export const toolRuns = pgTable("tool_runs", {
  id: id(),
  analysisId: uuid("analysis_id").references(() => analyses.id, {
    onDelete: "set null",
  }),
  tool: text("tool").notNull(),
  toolVersion: text("tool_version").notNull(),
  caseName: text("case_name"),
  inputs: jsonb("inputs").$type<Json>().notNull(),
  outputs: jsonb("outputs").$type<Json>(),
  createdBy: uuid("created_by").references(() => users.id),
  ...timestamps(),
});

export const reviews = pgTable("reviews", {
  id: id(),
  analysisId: uuid("analysis_id")
    .notNull()
    .references(() => analyses.id, { onDelete: "cascade" }),
  reviewerId: uuid("reviewer_id")
    .notNull()
    .references(() => users.id),
  decision: reviewDecision("decision").notNull().default("pending"),
  comments: text("comments"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  ...timestamps(),
});

/**
 * Append-only stage history. Time-in-stage, cycle time, and open-item age
 * are derived from these rows. The first transition has a null `from_stage`.
 */
export const stageTransitions = pgTable(
  "stage_transitions",
  {
    id: id(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    fromStage: workStage("from_stage"),
    toStage: workStage("to_stage").notNull(),
    changedBy: uuid("changed_by").references(() => users.id),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stage_transitions_issue_idx").on(table.issueId, table.changedAt),
  ],
);

/** Append-only activity feed. Rows are not updated. */
export const activityLog = pgTable(
  "activity_log",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("activity_entity_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
  ],
);

// ---------- Documents and contextual search ----------

export const documents = pgTable("documents", {
  id: id(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  title: text("title").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  status: docStatus("status").notNull().default("uploaded"),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  ...timestamps(),
});

/**
 * One chunk of an uploaded document plus its embedding.
 * Embedding model: all-MiniLM-L6-v2, 384 dimensions, L2-normalized.
 *
 * Column names match `DocumentChunk` in src/schemas/documents.ts:
 * `index`, `text`, `startOffset`, `endOffset`, `pageStart`, `pageEnd`.
 * Offsets are UTF-16 indexes into the extracted text, end exclusive.
 * `pageStart` and `pageEnd` are 1-based and set together when the chunk
 * covers one or more pages; both are null when the source has no pages.
 * Offsets are nullable here so a row can be stored before that metadata.
 */
export const documentChunks = pgTable(
  "document_chunks",
  {
    id: id(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    text: text("text").notNull(),
    startOffset: integer("start_offset"),
    endOffset: integer("end_offset"),
    pageStart: integer("page_start"),
    pageEnd: integer("page_end"),
    embedding: vector("embedding", {
      dimensions: DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS,
    }).notNull(),
  },
  (table) => [
    uniqueIndex("chunks_doc_idx_uq").on(table.documentId, table.index),
    index("chunks_embedding_hnsw").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

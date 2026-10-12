import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { getDb, type Database } from "@/db";
import { nextAnalysisCodeSql } from "@/db/analysis-code";
import {
  analysisCases,
  analyses,
  assets,
  issues,
  repairRevisions,
  repairs,
} from "@/db/schema";
import {
  analysisCreateSchema,
  analysisSchema,
  idSchema,
  type Analysis,
} from "@/schemas";

/**
 * Database handle tests pass in. Production calls use `getDb()`.
 * Creating an analysis does not change `issues.stage`.
 */
export type AnalysisStore = Pick<Database, "select" | "execute">;

export type CreateAnalysisInput = {
  orgId: string;
  repairId: string;
  /** User id, or null until a session exists (#13). */
  actorId: string | null;
  title: string;
  method?: string | null;
  loadCase?: string;
  margin: number;
  status?: Analysis["status"];
  dueDate?: string | null;
  revision?: string;
};

export type CreateAnalysisResult =
  { kind: "ok"; analysis: Analysis } | { kind: "not_found" };

/**
 * Insert one analysis for a repair in `orgId`, plus one `analysis_cases`
 * row for `margin`. The repair check, the revision, the analysis, and the
 * case are one statement. A missing repair and a repair in another
 * organization are both `not_found`, and neither consumes a code.
 *
 * The analysis hangs off a repair revision (`repair_revision_id`). The
 * revision letter is the `rev` column. The statement inserts that row and,
 * when `(repair_id, rev)` already exists, runs
 * `ON CONFLICT DO UPDATE SET rev = EXCLUDED.rev`. That assignment is a
 * no-op: it changes no other column, including `updated_at`. `DO UPDATE`
 * still returns the existing row, so two first creates that race share one
 * revision. `DO NOTHING` would not return it.
 *
 * Postgres runs every CTE in this statement against one snapshot, so the
 * statement reads the new revision, analysis, and case only from `RETURNING`.
 * It does not join those tables again. `nextval` runs only in the analysis
 * insert, after the revision id is chosen.
 */
export async function createAnalysis(
  input: CreateAnalysisInput,
  db: AnalysisStore = getDb(),
): Promise<CreateAnalysisResult> {
  if (
    !idSchema.safeParse(input.orgId).success ||
    !idSchema.safeParse(input.repairId).success
  ) {
    return { kind: "not_found" };
  }
  if (input.actorId !== null && !idSchema.safeParse(input.actorId).success) {
    throw new Error("actorId must be a UUID.");
  }

  const fields = analysisCreateSchema.parse({
    repairId: input.repairId,
    title: input.title,
    method: input.method,
    loadCase: input.loadCase,
    margin: input.margin,
    status: input.status,
    dueDate: input.dueDate,
    revision: input.revision,
  });
  const method = fields.method ?? null;
  const loadCase = fields.loadCase ?? "Primary";
  const status = fields.status ?? "draft";
  const revision = fields.revision ?? "A";
  const dueDate = fields.dueDate ?? null;
  const margin = fields.margin.toFixed(3);
  const createdBy =
    input.actorId === null ? sql`null` : sql`${input.actorId}::uuid`;
  const dueSql = dueDate === null ? sql`null` : sql`${dueDate}::date`;

  const result = await db.execute<Record<string, unknown>>(sql`
    WITH scoped AS (
      SELECT r.id AS repair_id
      FROM repairs AS r
      INNER JOIN issues AS i ON i.id = r.issue_id
      INNER JOIN assets AS a ON a.id = i.asset_id
      WHERE r.id = ${input.repairId}::uuid
        AND a.org_id = ${input.orgId}::uuid
    ),
    chosen AS (
      INSERT INTO repair_revisions (id, repair_id, rev, created_by)
      SELECT gen_random_uuid(), scoped.repair_id, ${revision}, ${createdBy}
      FROM scoped
      ON CONFLICT (repair_id, rev)
      DO UPDATE SET rev = EXCLUDED.rev
      RETURNING id, repair_id
    ),
    inserted AS (
      INSERT INTO analyses (
        id,
        code,
        repair_revision_id,
        title,
        method,
        status,
        created_by,
        due_date
      )
      SELECT
        gen_random_uuid(),
        ${nextAnalysisCodeSql()},
        chosen.id,
        ${fields.title},
        ${method},
        ${status}::analysis_status,
        ${createdBy},
        ${dueSql}
      FROM chosen
      RETURNING
        id,
        code,
        repair_revision_id,
        title,
        method,
        status,
        created_by,
        due_date,
        created_at,
        updated_at
    ),
    cased AS (
      INSERT INTO analysis_cases (id, analysis_id, name, margin)
      SELECT gen_random_uuid(), inserted.id, ${loadCase}, ${margin}::numeric
      FROM inserted
      RETURNING analysis_id, name, margin
    )
    SELECT
      inserted.id,
      inserted.code,
      chosen.repair_id AS "repairId",
      inserted.repair_revision_id AS "revisionId",
      ${revision} AS "revision",
      inserted.title,
      inserted.method,
      cased.name AS "loadCase",
      cased.margin,
      inserted.status,
      inserted.created_by AS "createdBy",
      inserted.due_date AS "dueDate",
      inserted.created_at AS "createdAt",
      inserted.updated_at AS "updatedAt"
    FROM inserted
    INNER JOIN cased ON cased.analysis_id = inserted.id
    INNER JOIN chosen ON chosen.id = inserted.repair_revision_id
  `);

  const row = rowsFrom(result)[0];
  if (!row) {
    return { kind: "not_found" };
  }
  return { kind: "ok", analysis: analysisFromRow(row) };
}

/** The analysis in this organization, or null when the id is missing or elsewhere. */
export async function getAnalysis(
  orgId: string,
  id: string,
  db: AnalysisStore = getDb(),
): Promise<Analysis | null> {
  if (!idSchema.safeParse(orgId).success || !idSchema.safeParse(id).success) {
    return null;
  }

  const rows = await db
    .select({
      id: analyses.id,
      code: analyses.code,
      repairId: repairs.id,
      revisionId: repairRevisions.id,
      revision: repairRevisions.rev,
      title: analyses.title,
      method: analyses.method,
      status: analyses.status,
      createdBy: analyses.createdBy,
      dueDate: analyses.dueDate,
      createdAt: analyses.createdAt,
      updatedAt: analyses.updatedAt,
    })
    .from(analyses)
    .innerJoin(
      repairRevisions,
      eq(repairRevisions.id, analyses.repairRevisionId),
    )
    .innerJoin(repairs, eq(repairs.id, repairRevisions.repairId))
    .innerJoin(issues, eq(issues.id, repairs.issueId))
    .innerJoin(assets, eq(assets.id, issues.assetId))
    .where(and(eq(assets.orgId, orgId), eq(analyses.id, id)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const cases = await db
    .select({ name: analysisCases.name, margin: analysisCases.margin })
    .from(analysisCases)
    .where(eq(analysisCases.analysisId, id))
    .orderBy(asc(analysisCases.margin), asc(analysisCases.id))
    .limit(1);
  const load = cases[0];

  return analysisSchema.parse({
    ...row,
    loadCase: load?.name ?? null,
    margin: load ? Number(load.margin) : null,
    dueDate: readDay(row.dueDate),
    createdAt: asTimestamp(row.createdAt),
    updatedAt: asTimestamp(row.updatedAt),
  });
}

function analysisFromRow(row: unknown): Analysis {
  if (!isRecord(row)) {
    throw new Error("Analysis insert returned an unreadable row.");
  }
  const createdBy = readNullableString(row, "createdBy", "created_by");
  const method = readNullableString(row, "method");
  const loadCase = readNullableString(row, "loadCase", "load_case");
  const margin = readMargin(row, "margin");
  return analysisSchema.parse({
    id: readString(row, "id"),
    code: readString(row, "code"),
    repairId: readString(row, "repairId", "repair_id"),
    revisionId: readString(row, "revisionId", "repair_revision_id"),
    revision: readString(row, "revision"),
    title: readString(row, "title"),
    method: method === undefined ? null : method,
    loadCase: loadCase === undefined ? null : loadCase,
    margin,
    status: readString(row, "status"),
    createdBy: createdBy === undefined ? null : createdBy,
    dueDate: readDay(row.dueDate ?? row.due_date),
    createdAt: readTimestamp(row, "createdAt", "created_at"),
    updatedAt: readTimestamp(row, "updatedAt", "updated_at"),
  });
}

function rowsFrom(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (isRecord(result) && Array.isArray(result.rows)) {
    return result.rows;
  }
  throw new Error("Analysis insert did not return rows.");
}

function readString(
  row: Record<string, unknown>,
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function readNullableString(
  row: Record<string, unknown>,
  ...keys: readonly string[]
): string | null | undefined {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) {
      continue;
    }
    const value = row[key];
    if (value === null) {
      return null;
    }
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}

function readMargin(
  row: Record<string, unknown>,
  ...keys: readonly string[]
): number | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) {
      continue;
    }
    const value = row[key];
    if (value === null) {
      return null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function readTimestamp(
  row: Record<string, unknown>,
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const instant = asDate(row[key]);
    if (instant) {
      return instant.toISOString();
    }
  }
  return undefined;
}

function readDay(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const instant = asDate(value);
  return instant ? instant.toISOString().slice(0, 10) : null;
}

function asTimestamp(value: Date | string): string {
  const instant = asDate(value);
  if (!instant) {
    throw new Error("Analysis timestamp is invalid.");
  }
  return instant.toISOString();
}

function asDate(value: unknown): Date | null {
  const instant =
    value instanceof Date
      ? value
      : typeof value === "string"
        ? new Date(value)
        : null;
  if (!instant || Number.isNaN(instant.getTime())) {
    return null;
  }
  return instant;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

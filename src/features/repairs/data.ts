import "server-only";

import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { getDb, type Database } from "@/db";
import { nextRepairCodeSql } from "@/db/repair-code";
import { assets, issues, repairs } from "@/db/schema";
import {
  idSchema,
  repairCreateSchema,
  repairListFiltersSchema,
  repairSchema,
  type Repair,
  type RepairListFilters,
} from "@/schemas";

/**
 * Database handle tests pass in. Production calls use `getDb()`.
 * `createRepair` does not change `issues.stage` and does not write
 * `stage_transitions`. Moving the finding to `repair_defined` is
 * `advanceStage`'s job.
 */
export type RepairStore = Pick<Database, "select" | "execute">;

export type CreateRepairInput = {
  orgId: string;
  findingId: string;
  /** User id, or null until a session exists (#13). */
  actorId: string | null;
  title: string;
  type?: string | null;
  status?: Repair["status"];
};

export type CreateRepairResult =
  { kind: "ok"; repair: Repair } | { kind: "not_found" };

/**
 * Insert one repair for a finding in `orgId`. The finding check and the
 * insert are one statement: `INSERT ... SELECT ... FROM issues JOIN assets`.
 * A missing finding and a finding in another organization are both
 * `not_found`, and neither consumes a repair code. The code is `nextval`
 * inside that select.
 */
export async function createRepair(
  input: CreateRepairInput,
  db: RepairStore = getDb(),
): Promise<CreateRepairResult> {
  if (
    !idSchema.safeParse(input.orgId).success ||
    !idSchema.safeParse(input.findingId).success
  ) {
    return { kind: "not_found" };
  }
  if (input.actorId !== null && !idSchema.safeParse(input.actorId).success) {
    throw new Error("actorId must be a UUID.");
  }

  const fields = repairCreateSchema.parse({
    findingId: input.findingId,
    title: input.title,
    type: input.type,
    status: input.status,
  });
  const status = fields.status ?? "open";
  const type = fields.type ?? null;
  const createdBy =
    input.actorId === null ? sql`null` : sql`${input.actorId}::uuid`;

  const result = await db.execute<Record<string, unknown>>(sql`
    INSERT INTO repairs (
      id,
      code,
      issue_id,
      title,
      type,
      status,
      created_by
    )
    SELECT
      gen_random_uuid(),
      ${nextRepairCodeSql()},
      i.id,
      ${fields.title},
      ${type},
      ${status}::repair_status,
      ${createdBy}
    FROM issues AS i
    INNER JOIN assets AS a ON a.id = i.asset_id
    WHERE i.id = ${input.findingId}::uuid
      AND a.org_id = ${input.orgId}::uuid
    RETURNING
      id,
      code,
      issue_id AS "findingId",
      title,
      type,
      status,
      created_by AS "createdBy",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `);

  const row = rowsFrom(result)[0];
  if (!row) {
    return { kind: "not_found" };
  }
  return { kind: "ok", repair: repairFromRow(row) };
}

/** The repair in this organization, or null when the id is missing or elsewhere. */
export async function getRepair(
  orgId: string,
  id: string,
  db: RepairStore = getDb(),
): Promise<Repair | null> {
  if (!idSchema.safeParse(orgId).success || !idSchema.safeParse(id).success) {
    return null;
  }

  const rows = await db
    .select(repairColumns())
    .from(repairs)
    .innerJoin(issues, eq(issues.id, repairs.issueId))
    .innerJoin(assets, eq(assets.id, issues.assetId))
    .where(and(eq(assets.orgId, orgId), eq(repairs.id, id)))
    .limit(1);

  const row = rows[0];
  return row ? toRepair(row) : null;
}

/**
 * Repairs whose finding belongs to `orgId`. Optional `findingId` and
 * `status` narrow the list. Order is `created_at` descending, then `id`
 * descending.
 */
export async function listRepairs(
  orgId: string,
  filters?: RepairListFilters,
  db: RepairStore = getDb(),
): Promise<Repair[]> {
  if (!idSchema.safeParse(orgId).success) {
    return [];
  }
  const parsed = repairListFiltersSchema.parse(filters ?? {});
  const conditions: SQL[] = [eq(assets.orgId, orgId)];
  if (parsed.findingId !== undefined) {
    conditions.push(eq(repairs.issueId, parsed.findingId));
  }
  if (parsed.status !== undefined) {
    conditions.push(eq(repairs.status, parsed.status));
  }
  const where = and(...conditions);
  if (!where) {
    throw new Error("Repair list is missing its organization filter.");
  }

  const rows = await db
    .select(repairColumns())
    .from(repairs)
    .innerJoin(issues, eq(issues.id, repairs.issueId))
    .innerJoin(assets, eq(assets.id, issues.assetId))
    .where(where)
    .orderBy(desc(repairs.createdAt), desc(repairs.id));

  return rows.map((row) => toRepair(row));
}

function repairColumns() {
  return {
    id: repairs.id,
    code: repairs.code,
    findingId: repairs.issueId,
    title: repairs.title,
    type: repairs.type,
    status: repairs.status,
    createdBy: repairs.createdBy,
    createdAt: repairs.createdAt,
    updatedAt: repairs.updatedAt,
  };
}

function toRepair(row: {
  id: string;
  code: string;
  findingId: string;
  title: string;
  type: string | null;
  status: Repair["status"];
  createdBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): Repair {
  return repairSchema.parse({
    ...row,
    createdAt: asTimestamp(row.createdAt),
    updatedAt: asTimestamp(row.updatedAt),
  });
}

function repairFromRow(row: unknown): Repair {
  if (!isRecord(row)) {
    throw new Error("Repair insert returned an unreadable row.");
  }
  const createdBy = readNullableString(row, "createdBy", "created_by");
  const type = readNullableString(row, "type");
  return repairSchema.parse({
    id: readString(row, "id"),
    code: readString(row, "code"),
    findingId: readString(row, "findingId", "issue_id"),
    title: readString(row, "title"),
    type: type === undefined ? null : type,
    status: readString(row, "status"),
    createdBy: createdBy === undefined ? null : createdBy,
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
  throw new Error("Repair insert did not return rows.");
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

function readTimestamp(
  row: Record<string, unknown>,
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = row[key];
    const instant =
      value instanceof Date
        ? value
        : typeof value === "string"
          ? new Date(value)
          : null;
    if (instant && !Number.isNaN(instant.getTime())) {
      return instant.toISOString();
    }
  }
  return undefined;
}

function asTimestamp(value: Date | string): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new Error("Repair timestamp is invalid.");
  }
  return instant.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

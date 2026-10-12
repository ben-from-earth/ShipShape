import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { isAllowedStageTransition } from "@/config/workflow";
import { getDb, type Database } from "@/db";
import { assets, issues } from "@/db/schema";
import { findingStageSchema, idSchema, type FindingStage } from "@/schemas";

/**
 * Why a stage change was refused. These are expected outcomes, not exceptions.
 * `not_found` covers a missing id and a finding in another organization.
 * `invalid_transition` covers an unknown stage, the same stage, and any move
 * the shared map does not list. `conflict` means the stage changed after it
 * was read, so the guarded update matched nothing and wrote no history row.
 */
export type AdvanceStageError = "not_found" | "invalid_transition" | "conflict";

export type StageTransitionRecord = {
  id: string;
  issueId: string;
  fromStage: FindingStage;
  toStage: FindingStage;
  changedBy: string | null;
  changedAt: string;
};

export type AdvanceStageResult =
  | {
      kind: "ok";
      stage: FindingStage;
      transition: StageTransitionRecord;
    }
  | { kind: AdvanceStageError };

export type AdvanceStageInput = {
  orgId: string;
  findingId: string;
  toStage: string;
  actorId: string;
};

export type StageAdvanceWrite = {
  orgId: string;
  findingId: string;
  fromStage: FindingStage;
  toStage: FindingStage;
  actorId: string;
};

type StageDb = Pick<Database, "select" | "execute">;

/**
 * Move a finding to `toStage` and append `stage_transitions` for `actorId`.
 *
 * The current stage is read first and checked against `src/config/workflow.ts`.
 * The update and the history insert then run as one statement, guarded on that
 * stage and on `assets.org_id` (`issues` has no `org_id`). Neon HTTP cannot
 * hold an interactive transaction, so a separate insert would be able to record
 * a move that did not happen.
 */
export async function advanceStage(
  input: AdvanceStageInput,
  db: StageDb = getDb(),
): Promise<AdvanceStageResult> {
  if (!findingStageSchema.safeParse(input.toStage).success) {
    return { kind: "invalid_transition" };
  }
  if (
    !idSchema.safeParse(input.orgId).success ||
    !idSchema.safeParse(input.findingId).success
  ) {
    return { kind: "not_found" };
  }
  if (!idSchema.safeParse(input.actorId).success) {
    throw new Error("actorId must be a UUID.");
  }

  const fromStage = await readFindingStage(db, input.orgId, input.findingId);
  if (!fromStage) {
    return { kind: "not_found" };
  }
  const toStage = findingStageSchema.parse(input.toStage);
  if (!isAllowedStageTransition(fromStage, toStage)) {
    return { kind: "invalid_transition" };
  }

  return applyStageAdvance(db, {
    orgId: input.orgId,
    findingId: input.findingId,
    fromStage,
    toStage,
    actorId: input.actorId,
  });
}

/**
 * Compare-and-swap write used by {@link advanceStage}. `fromStage` is the stage
 * the caller believes is current. A concurrent update makes this a `conflict`
 * and inserts no history row. Pass a database from tests; production callers
 * use {@link advanceStage}.
 */
export async function applyStageAdvance(
  db: StageDb,
  input: StageAdvanceWrite,
): Promise<AdvanceStageResult> {
  if (!isAllowedStageTransition(input.fromStage, input.toStage)) {
    return { kind: "invalid_transition" };
  }

  const written = await writeStageAdvance(db, input);
  if (written) {
    return { kind: "ok", stage: written.toStage, transition: written };
  }

  const current = await readFindingStage(db, input.orgId, input.findingId);
  if (!current) {
    return { kind: "not_found" };
  }
  return { kind: "conflict" };
}

async function readFindingStage(
  db: StageDb,
  orgId: string,
  findingId: string,
): Promise<FindingStage | null> {
  const rows = await db
    .select({ stage: issues.stage })
    .from(issues)
    .innerJoin(assets, eq(assets.id, issues.assetId))
    .where(and(eq(issues.id, findingId), eq(assets.orgId, orgId)))
    .limit(1);
  return rows[0]?.stage ?? null;
}

/**
 * One statement: update the issue only when its stage and organization still
 * match, then insert the history row from that update. A foreign-key failure
 * on `changed_by` aborts the statement, so the stage change rolls back too.
 * `updated_at` is set here because a raw update does not run Drizzle's hook.
 */
async function writeStageAdvance(
  db: StageDb,
  input: StageAdvanceWrite,
): Promise<StageTransitionRecord | null> {
  const result = await db.execute<Record<string, unknown>>(sql`
    WITH upd AS (
      UPDATE issues AS i
      SET stage = ${input.toStage}::work_stage,
          updated_at = now()
      FROM assets AS a
      WHERE i.asset_id = a.id
        AND i.id = ${input.findingId}::uuid
        AND a.org_id = ${input.orgId}::uuid
        AND i.stage = ${input.fromStage}::work_stage
      RETURNING i.id
    )
    INSERT INTO stage_transitions (
      id,
      issue_id,
      from_stage,
      to_stage,
      changed_by
    )
    SELECT
      gen_random_uuid(),
      upd.id,
      ${input.fromStage}::work_stage,
      ${input.toStage}::work_stage,
      ${input.actorId}::uuid
    FROM upd
    RETURNING
      id,
      issue_id AS "issueId",
      from_stage AS "fromStage",
      to_stage AS "toStage",
      changed_by AS "changedBy",
      changed_at AS "changedAt"
  `);

  const rows = rowsFrom(result);
  const row = rows[0];
  if (!row) {
    return null;
  }
  return transitionFromRow(row);
}

function rowsFrom(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result;
  }
  if (isRecord(result) && Array.isArray(result.rows)) {
    return result.rows;
  }
  throw new Error("Stage advance query did not return rows.");
}

function transitionFromRow(row: unknown): StageTransitionRecord {
  if (!isRecord(row)) {
    throw new Error("Stage advance returned an unreadable transition row.");
  }

  const id = readString(row, "id");
  const issueId = readString(row, "issueId", "issue_id");
  const fromStage = findingStageSchema.safeParse(
    readString(row, "fromStage", "from_stage"),
  );
  const toStage = findingStageSchema.safeParse(
    readString(row, "toStage", "to_stage"),
  );
  const changedBy = readNullableString(row, "changedBy", "changed_by");
  const changedAt = readTimestamp(row, "changedAt", "changed_at");

  if (
    !id ||
    !idSchema.safeParse(id).success ||
    !issueId ||
    !idSchema.safeParse(issueId).success ||
    !fromStage.success ||
    !toStage.success ||
    changedBy === undefined ||
    (changedBy !== null && !idSchema.safeParse(changedBy).success) ||
    !changedAt
  ) {
    throw new Error(
      `Stage advance returned an unreadable transition row: ${Object.keys(row).join(", ")}`,
    );
  }

  return {
    id,
    issueId,
    fromStage: fromStage.data,
    toStage: toStage.data,
    changedBy,
    changedAt,
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

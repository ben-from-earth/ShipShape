import { sql, type SQL } from "drizzle-orm";

import type { Database } from "./index";
import { repairCodeSeq } from "./schema";

/**
 * `repairs.code` is a global human id: prefix plus a decimal integer, padded
 * to at least four digits. Wider values stay whole (`REP-10000`).
 */
export const REPAIR_CODE_PREFIX = "REP-";
export const REPAIR_CODE_MIN_DIGITS = 4;

const sequenceName = sequenceRegclassName(repairCodeSeq.seqName);

function sequenceRegclassName(name: string | undefined): string {
  if (name === undefined || !/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error("Repair code sequence name is missing or unsafe.");
  }
  return name;
}

/** `REP-` plus the sequence integer, padded to at least four digits. */
export function formatRepairCode(value: bigint | number | string): string {
  const parsed = typeof value === "bigint" ? value : BigInt(value);
  if (parsed < BigInt(0)) {
    throw new Error("Repair codes are generated from a non-negative sequence.");
  }
  return `${REPAIR_CODE_PREFIX}${parsed.toString().padStart(REPAIR_CODE_MIN_DIGITS, "0")}`;
}

/**
 * Scalar SQL that allocates one repair code. `nextval` runs once.
 * `createRepair` uses this inside the insert, so a finding that is not in
 * the organization does not consume a value.
 */
export function nextRepairCodeSql(): SQL<string> {
  return sql<string>`(
    select ${sql.raw(`'${REPAIR_CODE_PREFIX}'`)} || lpad(
      issued.n::text,
      greatest(${sql.raw(String(REPAIR_CODE_MIN_DIGITS))}, char_length(issued.n::text)),
      '0'
    )
    from (select nextval(${sql.raw(`'${sequenceName}'::regclass`)}) as n) as issued
  )`;
}

/** Allocates the next `repairs.code` (`REP-1002`, then `REP-1003`, …). */
export async function nextRepairCode(
  db: Pick<Database, "execute">,
): Promise<string> {
  const result = await db.execute<{ code: string }>(
    sql`select ${nextRepairCodeSql()} as code`,
  );
  const code = result.rows[0]?.code;
  if (typeof code !== "string" || code.length === 0) {
    throw new Error("Repair code sequence returned no value.");
  }
  return code;
}

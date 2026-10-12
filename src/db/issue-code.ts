import { sql, type SQL } from "drizzle-orm";

import type { Database } from "./index";
import { issueCodeSeq } from "./schema";

/**
 * `issues.code` matches the demo seed `ISS-1001`: prefix plus a decimal
 * integer, padded to at least four digits. Values with more digits are kept
 * whole (`ISS-10000`), matching `String.prototype.padStart`.
 */
export const ISSUE_CODE_PREFIX = "ISS-";
export const ISSUE_CODE_MIN_DIGITS = 4;

const sequenceName = sequenceRegclassName(issueCodeSeq.seqName);

function sequenceRegclassName(name: string | undefined): string {
  if (name === undefined || !/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error("Issue code sequence name is missing or unsafe.");
  }
  return name;
}

/** `ISS-` plus the sequence integer, padded to at least four digits. */
export function formatIssueCode(value: bigint | number | string): string {
  const parsed = typeof value === "bigint" ? value : BigInt(value);
  if (parsed < BigInt(0)) {
    throw new Error("Issue codes are generated from a non-negative sequence.");
  }
  return `${ISSUE_CODE_PREFIX}${parsed.toString().padStart(ISSUE_CODE_MIN_DIGITS, "0")}`;
}

/**
 * Scalar SQL that allocates one issue code. `nextval` runs once.
 * Use it as `issues.code`, including inside `db.batch`.
 *
 * ```ts
 * await db.batch([
 *   db.insert(issues).values({
 *     code: nextIssueCodeSql(),
 *     assetId,
 *     severity: "medium",
 *     description,
 *   }),
 * ]);
 * ```
 */
export function nextIssueCodeSql(): SQL<string> {
  return sql<string>`(
    select ${sql.raw(`'${ISSUE_CODE_PREFIX}'`)} || lpad(
      issued.n::text,
      greatest(${sql.raw(String(ISSUE_CODE_MIN_DIGITS))}, char_length(issued.n::text)),
      '0'
    )
    from (select nextval(${sql.raw(`'${sequenceName}'::regclass`)}) as n) as issued
  )`;
}

/**
 * Allocates the next `issues.code` (`ISS-1002`, then `ISS-1003`, …).
 * Concurrent calls receive distinct codes. `nextval` is safe across
 * connections and is not reused when a transaction rolls back.
 */
export async function nextIssueCode(
  db: Pick<Database, "execute">,
): Promise<string> {
  const result = await db.execute<{ code: string }>(
    sql`select ${nextIssueCodeSql()} as code`,
  );
  const code = result.rows[0]?.code;
  if (typeof code !== "string" || code.length === 0) {
    throw new Error("Issue code sequence returned no value.");
  }
  return code;
}

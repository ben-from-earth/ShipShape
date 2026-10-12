import { sql, type SQL } from "drizzle-orm";

import type { Database } from "./index";
import { analysisCodeSeq } from "./schema";

/**
 * `analyses.code` matches the demo seed `AN-1001`: prefix plus a decimal
 * integer, padded to at least four digits. Wider values stay whole
 * (`AN-10000`).
 */
export const ANALYSIS_CODE_PREFIX = "AN-";
export const ANALYSIS_CODE_MIN_DIGITS = 4;

const sequenceName = sequenceRegclassName(analysisCodeSeq.seqName);

function sequenceRegclassName(name: string | undefined): string {
  if (name === undefined || !/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error("Analysis code sequence name is missing or unsafe.");
  }
  return name;
}

/** `AN-` plus the sequence integer, padded to at least four digits. */
export function formatAnalysisCode(value: bigint | number | string): string {
  const parsed = typeof value === "bigint" ? value : BigInt(value);
  if (parsed < BigInt(0)) {
    throw new Error(
      "Analysis codes are generated from a non-negative sequence.",
    );
  }
  return `${ANALYSIS_CODE_PREFIX}${parsed.toString().padStart(ANALYSIS_CODE_MIN_DIGITS, "0")}`;
}

/**
 * Scalar SQL that allocates one analysis code. `nextval` runs once.
 * `createAnalysis` uses this inside the insert, so a repair that is not in
 * the organization does not consume a value.
 */
export function nextAnalysisCodeSql(): SQL<string> {
  return sql<string>`(
    select ${sql.raw(`'${ANALYSIS_CODE_PREFIX}'`)} || lpad(
      issued.n::text,
      greatest(${sql.raw(String(ANALYSIS_CODE_MIN_DIGITS))}, char_length(issued.n::text)),
      '0'
    )
    from (select nextval(${sql.raw(`'${sequenceName}'::regclass`)}) as n) as issued
  )`;
}

/** Allocates the next `analyses.code` (`AN-1002`, then `AN-1003`, …). */
export async function nextAnalysisCode(
  db: Pick<Database, "execute">,
): Promise<string> {
  const result = await db.execute<{ code: string }>(
    sql`select ${nextAnalysisCodeSql()} as code`,
  );
  const code = result.rows[0]?.code;
  if (typeof code !== "string" || code.length === 0) {
    throw new Error("Analysis code sequence returned no value.");
  }
  return code;
}

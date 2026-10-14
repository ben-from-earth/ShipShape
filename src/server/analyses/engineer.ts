import { sql } from "drizzle-orm";
import "server-only";

import type { EngineeringDb } from "@/db/engineering";
import { engineerSchema, idSchema, type Engineer } from "@/schemas";
import { readSessionToken } from "@/server/auth/cookie";
import { findEngineerBySessionToken } from "@/server/auth/store";

import { AnalysisRequestError } from "./errors";

/**
 * Dev and test stand-in. Production ignores this header and uses the
 * session cookie from POST /api/auth/sign-in.
 */
export const ENGINEER_ID_HEADER = "x-engineer-id";

/**
 * Loads the engineer for this request. A session cookie wins. Outside
 * production, a missing cookie falls back to `x-engineer-id`.
 */
export async function readRequestEngineer(
  request: Request,
  db: EngineeringDb,
): Promise<Engineer> {
  const token = readSessionToken(request);
  if (token) {
    const engineer = await findEngineerBySessionToken(db, token);
    if (!engineer) {
      throw new AnalysisRequestError("unauthenticated", "Sign in is required.");
    }
    return engineer;
  }

  if (process.env.NODE_ENV === "production") {
    throw new AnalysisRequestError("unauthenticated", "Sign in is required.");
  }

  const header = request.headers.get(ENGINEER_ID_HEADER);
  const parsed = idSchema.safeParse(header ?? "");
  if (!parsed.success) {
    throw new AnalysisRequestError(
      "unauthenticated",
      "x-engineer-id must be an engineer id.",
    );
  }

  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT id, name, email, role, created_at AS "createdAt"
    FROM engineers
    WHERE id = ${parsed.data}::uuid
  `);
  const found = rows(result)[0];
  if (!found) {
    throw new AnalysisRequestError(
      "unauthenticated",
      "That engineer was not found.",
    );
  }

  return engineerSchema.parse({
    id: found.id,
    name: found.name,
    email: found.email,
    role: found.role,
    createdAt: asTimestamp(found.createdAt),
  });
}

function asTimestamp(value: unknown): string {
  const instant = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(instant.getTime())) {
    throw new Error("Timestamp is invalid.");
  }
  return instant.toISOString();
}

function rows(result: unknown): Record<string, unknown>[] {
  const list = Array.isArray(result)
    ? result
    : isRecord(result) && Array.isArray(result.rows)
      ? result.rows
      : null;
  if (!list) {
    throw new Error("Query did not return rows.");
  }
  return list.filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

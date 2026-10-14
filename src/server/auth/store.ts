import { sql } from "drizzle-orm";
import "server-only";

import type { EngineeringDb } from "@/db/engineering";
import { engineerSchema, type Engineer } from "@/schemas";

import { hashSessionToken } from "./cookie";

export async function findEngineerCredentials(
  db: EngineeringDb,
  email: string,
): Promise<{ engineer: Engineer; passwordHash: string | null } | null> {
  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT
      id,
      name,
      email,
      role,
      password_hash AS "passwordHash",
      created_at AS "createdAt"
    FROM engineers
    WHERE lower(email) = lower(${email})
  `);
  const found = rows(result)[0];
  if (!found) {
    return null;
  }
  return {
    engineer: engineerSchema.parse({
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
      createdAt: asTimestamp(found.createdAt),
    }),
    passwordHash:
      typeof found.passwordHash === "string" ? found.passwordHash : null,
  };
}

export async function insertSession(
  db: EngineeringDb,
  input: { engineerId: string; tokenHash: string; expiresAt: Date },
): Promise<void> {
  await db.execute(sql`
    INSERT INTO sessions (id, token_hash, engineer_id, expires_at)
    VALUES (
      gen_random_uuid(),
      ${input.tokenHash},
      ${input.engineerId}::uuid,
      ${input.expiresAt.toISOString()}::timestamptz
    )
  `);
}

export async function deleteSession(
  db: EngineeringDb,
  tokenHash: string,
): Promise<void> {
  await db.execute(sql`
    DELETE FROM sessions WHERE token_hash = ${tokenHash}
  `);
}

export async function findEngineerBySessionToken(
  db: EngineeringDb,
  token: string,
): Promise<Engineer | null> {
  const result = await db.execute<Record<string, unknown>>(sql`
    SELECT
      e.id,
      e.name,
      e.email,
      e.role,
      e.created_at AS "createdAt"
    FROM sessions AS s
    INNER JOIN engineers AS e ON e.id = s.engineer_id
    WHERE s.token_hash = ${hashSessionToken(token)}
      AND s.expires_at > now()
  `);
  const found = rows(result)[0];
  if (!found) {
    return null;
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

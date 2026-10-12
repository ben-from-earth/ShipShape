import "server-only";

import { asc } from "drizzle-orm";
import { io } from "next/cache";

import { LOW_MARGIN_THRESHOLD } from "@/config/analysis";
import { getDb, type Database } from "@/db";
import { organizations } from "@/db/schema";

/**
 * Numeric column text to a cutoff. Missing, blank, and non-numeric values
 * use `LOW_MARGIN_THRESHOLD`.
 */
export function thresholdFromColumn(value: string | null | undefined): number {
  if (value == null || value.trim() === "") {
    return LOW_MARGIN_THRESHOLD;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : LOW_MARGIN_THRESHOLD;
}

/**
 * Oldest organization, then the lowest id when `created_at` ties.
 * Shared by the threshold lookup and the tenant snapshot.
 */
export function oldestOrganizationOrder() {
  return [asc(organizations.createdAt), asc(organizations.id)];
}

/** Oldest organization's cutoff. An empty database uses the fallback. */
export async function readLowMarginThreshold(
  db: Pick<Database, "select">,
): Promise<number> {
  const rows = await db
    .select({ value: organizations.lowMarginThreshold })
    .from(organizations)
    .orderBy(...oldestOrganizationOrder())
    .limit(1);

  return thresholdFromColumn(rows[0]?.value);
}

/**
 * Organization cutoff. Skips the database when `DATABASE_URL` is unset
 * and returns `LOW_MARGIN_THRESHOLD` (0.10). Analysis pages call this
 * through `src/features/dashboard/data.ts` and pass the number down.
 */
export async function getLowMarginThreshold(): Promise<number> {
  await io();

  if (!process.env.DATABASE_URL) {
    return LOW_MARGIN_THRESHOLD;
  }

  return readLowMarginThreshold(getDb());
}

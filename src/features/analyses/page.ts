import "server-only";

import { io } from "next/cache";

import { isDemoData } from "@/config/demo";
import { getDb, type Database } from "@/db";
import { organizations } from "@/db/schema";
import { oldestOrganizationOrder } from "@/lib/org-threshold";
import { idSchema, type Analysis } from "@/schemas";

import { getAnalysis } from "./data";
import { findDemoAnalysis } from "./page-demo";

/**
 * One analysis for `/analyses/[id]`.
 * Demo rows are used only when `isDemoData()` is on. With the flag off
 * this returns null, including when the database is unset.
 */
export async function getAnalysisPage(id: string): Promise<Analysis | null> {
  await io();

  if (!idSchema.safeParse(id).success) {
    return null;
  }
  if (isDemoData()) {
    return findDemoAnalysis(id);
  }
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const db = getDb();
  const orgId = await tenantOrgId(db);
  if (!orgId) {
    return null;
  }

  return getAnalysis(orgId, id, db);
}

async function tenantOrgId(
  db: Pick<Database, "select">,
): Promise<string | null> {
  const rows = await db
    .select({ id: organizations.id })
    .from(organizations)
    .orderBy(...oldestOrganizationOrder())
    .limit(1);
  return rows[0]?.id ?? null;
}

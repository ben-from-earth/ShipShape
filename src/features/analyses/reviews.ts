import "server-only";

import { io } from "next/cache";

import { and, desc, eq } from "drizzle-orm";

import { isDemoData } from "@/config/demo";
import { getDb, type Database } from "@/db";
import {
  analyses,
  assets,
  issues,
  organizations,
  repairRevisions,
  repairs,
  reviews,
} from "@/db/schema";
import { oldestOrganizationOrder } from "@/lib/org-threshold";
import { idSchema } from "@/schemas";

import { findDemoReviews } from "./review-demo";
import { reviewHistorySchema, type ReviewHistory } from "./review-history";

/**
 * Reviews recorded for one analysis.
 * Demo rows are used only when `isDemoData()` is on. With the flag off
 * and no database, the list is empty.
 */
export async function listAnalysisReviews(
  analysisId: string,
): Promise<ReviewHistory[]> {
  await io();

  if (!idSchema.safeParse(analysisId).success) {
    return [];
  }
  if (isDemoData()) {
    return findDemoReviews(analysisId);
  }
  if (!process.env.DATABASE_URL) {
    return [];
  }

  const db = getDb();
  const orgId = await tenantOrgId(db);
  if (!orgId) {
    return [];
  }

  const rows = await db
    .select({
      id: reviews.id,
      analysisId: reviews.analysisId,
      decision: reviews.decision,
      comment: reviews.comments,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(analyses, eq(analyses.id, reviews.analysisId))
    .innerJoin(
      repairRevisions,
      eq(repairRevisions.id, analyses.repairRevisionId),
    )
    .innerJoin(repairs, eq(repairs.id, repairRevisions.repairId))
    .innerJoin(issues, eq(issues.id, repairs.issueId))
    .innerJoin(assets, eq(assets.id, issues.assetId))
    .where(and(eq(assets.orgId, orgId), eq(analyses.id, analysisId)))
    .orderBy(desc(reviews.createdAt), desc(reviews.id));

  return rows.flatMap((row) => {
    const parsed = reviewHistorySchema.safeParse({
      ...row,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : row.createdAt,
    });
    return parsed.success ? [parsed.data] : [];
  });
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

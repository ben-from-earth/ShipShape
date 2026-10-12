import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { loadEnvConfig } from "@next/env";

import {
  demoActivity,
  demoAnalysis,
  demoAnalysisCase,
  demoAnalysisPeople,
  demoAsset,
  demoAssetGroup,
  demoDocument,
  demoDocumentChunk,
  demoIssue,
  demoIssueMedia,
  demoOrganization,
  demoRepair,
  demoRepairRevision,
  demoReview,
  demoStageTransition,
  demoToolRun,
  demoUsers,
} from "./demo-seed";
import {
  activityLog,
  analyses,
  analysisCases,
  analysisPeople,
  assetGroups,
  assets,
  documentChunks,
  documents,
  issueMedia,
  issues,
  organizations,
  repairRevisions,
  repairs,
  reviews,
  stageTransitions,
  toolRuns,
  users,
} from "./schema";

loadEnvConfig(process.cwd());

/**
 * Inserts the demo rows. Uses the Neon HTTP driver, same as getDb(), so the
 * pooled DATABASE_URL works. Existing rows are left in place.
 */
async function seed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.",
    );
  }

  const db = drizzle({ client: neon(databaseUrl) });

  await db.insert(organizations).values(demoOrganization).onConflictDoNothing();
  await db.insert(users).values(demoUsers).onConflictDoNothing();
  await db.insert(assetGroups).values(demoAssetGroup).onConflictDoNothing();
  await db.insert(assets).values(demoAsset).onConflictDoNothing();
  await db.insert(issues).values(demoIssue).onConflictDoNothing();
  await db.insert(issueMedia).values(demoIssueMedia).onConflictDoNothing();
  await db.insert(repairs).values(demoRepair).onConflictDoNothing();
  await db
    .insert(repairRevisions)
    .values(demoRepairRevision)
    .onConflictDoNothing();
  await db.insert(analyses).values(demoAnalysis).onConflictDoNothing();
  await db
    .insert(analysisPeople)
    .values(demoAnalysisPeople)
    .onConflictDoNothing();
  await db.insert(analysisCases).values(demoAnalysisCase).onConflictDoNothing();
  await db.insert(toolRuns).values(demoToolRun).onConflictDoNothing();
  await db.insert(reviews).values(demoReview).onConflictDoNothing();
  await db
    .insert(stageTransitions)
    .values(demoStageTransition)
    .onConflictDoNothing();
  await db.insert(activityLog).values(demoActivity).onConflictDoNothing();
  await db.insert(documents).values(demoDocument).onConflictDoNothing();
  await db
    .insert(documentChunks)
    .values(demoDocumentChunk)
    .onConflictDoNothing();
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

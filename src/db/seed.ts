import { pathToFileURL } from "node:url";

import { neon } from "@neondatabase/serverless";
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/neon-http";

import type { Database } from "@/db";
import {
  createAnalysis,
  createEngineer,
  listAnalyses,
  listEngineers,
  transitionAnalysis,
} from "@/db/engineering";

import {
  demoActivity,
  demoAnalysis,
  demoAnalysisCase,
  demoAnalysisPeople,
  demoAsset,
  demoAssetGroup,
  demoDocument,
  demoDocumentChunk,
  demoEngineeringTitles,
  demoEngineers,
  demoIssue,
  demoIssueMedia,
  demoOrganization,
  demoOverdueDay,
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

type SeedDb = Pick<Database, "insert" | "execute">;

/**
 * Inserts the demo rows. Existing rows are left in place. Engineers are
 * created through `createEngineer` unless `lower(email)` is already stored.
 */
export async function seedDemo(db: SeedDb): Promise<void> {
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

  await seedEngineers(db);
}

async function seedEngineers(db: SeedDb): Promise<void> {
  const directory = await listEngineers(db);
  const byEmail = new Map(
    directory.map((engineer) => [engineer.email.toLowerCase(), engineer]),
  );
  for (const input of demoEngineers) {
    if (byEmail.has(input.email.toLowerCase())) {
      continue;
    }
    byEmail.set(input.email.toLowerCase(), await createEngineer(db, input));
  }

  const analyst = byEmail.get("analyst@example.com");
  if (!analyst) {
    throw new Error("Demo analyst is missing.");
  }

  const titles = new Set(
    (await listAnalyses(db)).map((analysis) => analysis.title),
  );
  if (!titles.has(demoEngineeringTitles.unassigned)) {
    await createAnalysis(db, {
      title: demoEngineeringTitles.unassigned,
      createdBy: analyst.id,
    });
  }
  if (!titles.has(demoEngineeringTitles.assigned)) {
    await createAnalysis(db, {
      title: demoEngineeringTitles.assigned,
      assigneeId: analyst.id,
      createdBy: analyst.id,
    });
  }
  if (!titles.has(demoEngineeringTitles.overdue)) {
    const created = await createAnalysis(db, {
      title: demoEngineeringTitles.overdue,
      assigneeId: analyst.id,
      dueDate: demoOverdueDay,
      createdBy: analyst.id,
    });
    const started = await transitionAnalysis({
      db,
      analysisId: created.id,
      actorId: analyst.id,
      action: "start",
    });
    if (started.kind !== "ok") {
      throw new Error("Demo overdue analysis did not start.");
    }
  }
}

/**
 * Uses the Neon HTTP driver, same as getDb(), so the pooled DATABASE_URL
 * works. `react-server` lets this script import `createEngineer`.
 */
async function seed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.",
    );
  }

  const db = drizzle({ client: neon(databaseUrl) });
  await seedDemo(db as unknown as SeedDb);
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  seed().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

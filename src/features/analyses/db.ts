import "server-only";

import { LOW_MARGIN_THRESHOLD } from "@/config/analysis";
import { getDb, type Database } from "@/db";
import { loadOrEmpty } from "@/db/tenant";
import { readRequestClock } from "@/lib/request-day";

import { buildAnalysisRecords } from "./map";
import { listAnalyses as listDemoAnalyses } from "./demo";
import type { AnalysisRecord } from "./types";

/** Analysis list for an already-open database. */
export async function readAnalyses(
  db: Pick<Database, "query">,
  now: Date,
): Promise<AnalysisRecord[]> {
  return buildAnalysisRecords(await loadOrEmpty(db), now);
}

export type AnalysesPage = {
  records: AnalysisRecord[];
  /** UTC day from `readRequestClock`. Fixture mode is `DEMO_AS_OF`. */
  asOf: string;
  /** Cutoff from the same tenant snapshot as `records`. */
  marginThreshold: number;
};

/**
 * One clock read and one tenant lookup for the analyses page.
 * With no `DATABASE_URL` this returns the demo rows and the fixture day.
 */
export async function getAnalysesPage(): Promise<AnalysesPage> {
  const clock = await readRequestClock();

  if (!process.env.DATABASE_URL) {
    return {
      records: await listDemoAnalyses(),
      asOf: clock.asOf,
      marginThreshold: LOW_MARGIN_THRESHOLD,
    };
  }

  const snapshot = await loadOrEmpty(getDb());
  return {
    records: buildAnalysisRecords(snapshot, clock.now),
    asOf: clock.asOf,
    marginThreshold: snapshot.threshold,
  };
}

/**
 * Live analysis list. With no `DATABASE_URL` this returns the demo rows.
 * `readRequestClock` keeps the read out of the static shell.
 */
export async function listAnalyses(): Promise<AnalysisRecord[]> {
  return (await getAnalysesPage()).records;
}

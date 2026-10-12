import "server-only";

import { io } from "next/cache";

import { getDb, type Database } from "@/db";
import { loadOrEmpty } from "@/db/tenant";

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

/**
 * Live analysis list. With no `DATABASE_URL` this returns the demo rows.
 * `io()` keeps the read out of the static shell.
 */
export async function listAnalyses(): Promise<AnalysisRecord[]> {
  await io();

  if (!process.env.DATABASE_URL) {
    return listDemoAnalyses();
  }

  return readAnalyses(getDb(), new Date());
}

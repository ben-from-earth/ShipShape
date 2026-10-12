import "server-only";

import { ANALYSES } from "./fixtures";
import type { AnalysisRecord } from "./types";

/**
 * Fixture analysis list. The page imports `./data`, which re-exports
 * the database reader.
 */
export async function listAnalyses(): Promise<AnalysisRecord[]> {
  return ANALYSES.map((record) => ({ ...record }));
}

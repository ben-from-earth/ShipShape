import "server-only";

import { ANALYSES } from "./fixtures";
import type { AnalysisRecord } from "./types";

/**
 * Analysis list. Swap this read for a query later and keep the
 * `Promise<AnalysisRecord[]>` return type.
 */
export async function listAnalyses(): Promise<AnalysisRecord[]> {
  return ANALYSES.map((record) => ({ ...record }));
}

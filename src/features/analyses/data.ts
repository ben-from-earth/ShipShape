import "server-only";

import { ANALYSES } from "./fixtures";
import type { AnalysisRecord } from "./types";

/**
 * Analysis list. Swap this read for a query later and keep the
 * `AnalysisRecord[]` return type.
 */
export function listAnalyses(): AnalysisRecord[] {
  return ANALYSES.map((record) => ({ ...record }));
}

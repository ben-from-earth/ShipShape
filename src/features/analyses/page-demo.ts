import "server-only";

import type { StoredAnalysis } from "./stored";

/**
 * Demo analysis for an explicit `isDemoData()` session.
 * Ids match `demoAnalysis` in `src/db/demo-seed.ts`.
 * This module is not a stand-in for a missing database.
 */
const DEMO_ANALYSIS_ID = "10000000-0000-4000-8000-000000000051";

const DEMO_ANALYSIS: StoredAnalysis = {
  id: DEMO_ANALYSIS_ID,
  code: "AN-1001",
  repairId: "10000000-0000-4000-8000-000000000041",
  revisionId: "10000000-0000-4000-8000-000000000042",
  revision: "A",
  title: "Canopy sill margin",
  method: "Hand calculation",
  loadCase: "Limit load",
  margin: 0.04,
  status: "in_review",
  createdBy: null,
  dueDate: "2026-12-01",
  createdAt: "2026-10-06T12:00:00.000Z",
  updatedAt: "2026-10-06T12:00:00.000Z",
};

export function findDemoAnalysis(id: string): StoredAnalysis | null {
  if (id.trim() !== DEMO_ANALYSIS.id && id.trim() !== DEMO_ANALYSIS.code) {
    return null;
  }
  return DEMO_ANALYSIS;
}

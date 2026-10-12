import "server-only";

import { ANALYSES } from "./fixtures";
import type { AnalysisStatus } from "./types";
import type { AnalysisPageStatus, AnalysisView } from "./view";

/**
 * Demo analyses for an explicit `isDemoData()` session.
 * The seeded row uses the ids in `src/db/demo-seed.ts`.
 * List fixtures are included so Open analysis on the engineering page
 * resolves. This module is not a stand-in for a missing database.
 */

const LIST_STATUS: Record<AnalysisStatus, AnalysisPageStatus> = {
  draft: "draft",
  work: "in_progress",
  check: "in_review",
  rework: "changes_requested",
  ready: "in_review",
  done: "approved",
};

const SEEDED: readonly AnalysisView[] = [
  {
    id: "10000000-0000-4000-8000-000000000051",
    code: "AN-1001",
    title: "Canopy sill margin",
    method: "Hand calculation",
    status: "in_review",
    repair: {
      id: "10000000-0000-4000-8000-000000000041",
      code: "REP-1001",
      revision: "A",
      title: "Canopy sill doubler",
    },
    finding: {
      id: "10000000-0000-4000-8000-000000000031",
      code: "ISS-1001",
    },
    loadCases: [
      { name: "Limit load", margin: 0.25 },
      { name: "Repeated load", margin: 0.04 },
      { name: "Ultimate load", margin: -0.06 },
    ],
  },
];

function fromList(record: (typeof ANALYSES)[number]): AnalysisView {
  return {
    id: record.id,
    code: record.id,
    title: record.title,
    method: record.method.trim() ? record.method : null,
    status: LIST_STATUS[record.status],
    repair: {
      id: record.repair.id,
      code: record.repair.id,
      revision: record.repair.revision,
      title: record.repair.title,
    },
    finding: {
      id: record.issue.id,
      code: record.issue.id,
    },
    loadCases: record.cases.map((entry) => ({
      name: entry.name,
      margin: entry.margin,
    })),
  };
}

export function findDemoAnalysis(id: string): AnalysisView | null {
  const key = id.trim();
  const seeded = SEEDED.find(
    (record) => record.id === key || record.code === key,
  );
  if (seeded) {
    return structuredClone(seeded);
  }

  const listed = ANALYSES.find((record) => record.id === key);
  return listed ? fromList(listed) : null;
}

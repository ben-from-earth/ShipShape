import "server-only";

import { io } from "next/cache";

import { isDemoData } from "@/config/demo";
import { idSchema } from "@/schemas";

import {
  ANALYSIS_BOARD_STATUSES,
  type AnalysisBoardRecord,
  type AnalysisBoardStatus,
  type AnalysisBoardSummary,
  type EngineerRole,
} from "./board";
import {
  DEMO_ANALYSIS_AS_OF,
  DEMO_ENGINEER_ROLE,
  findDemoAnalysis,
  listDemoAnalyses,
} from "./board-demo";
import { averageApprovalDays, dueBadge, isDueThisWeek } from "./timing";

/**
 * Analyses for the list and dashboard.
 * Rows render only when `isDemoData()` is on.
 */
export async function listAnalysisBoard(filters?: {
  status?: AnalysisBoardStatus;
}): Promise<{ records: AnalysisBoardRecord[]; asOf: string }> {
  await io();
  const asOf = boardAsOf();
  if (!isDemoData()) {
    return { records: [], asOf };
  }
  const records = listDemoAnalyses().filter(
    (record) =>
      filters?.status === undefined || record.status === filters.status,
  );
  return { records: [...records], asOf };
}

/** Null when demo mode is off or the id is unknown. */
export async function getAnalysisBoard(id: string): Promise<{
  record: AnalysisBoardRecord;
  asOf: string;
  role: EngineerRole;
} | null> {
  await io();
  if (!idSchema.safeParse(id).success || !isDemoData()) {
    return null;
  }
  const record = findDemoAnalysis(id);
  if (!record) {
    return null;
  }
  return { record, asOf: boardAsOf(), role: DEMO_ENGINEER_ROLE };
}

export async function analysisBoardSummary(): Promise<{
  summary: AnalysisBoardSummary;
  asOf: string;
}> {
  const { records, asOf } = await listAnalysisBoard();
  const counts = Object.fromEntries(
    ANALYSIS_BOARD_STATUSES.map((status) => [
      status,
      records.filter((record) => record.status === status).length,
    ]),
  ) as Record<AnalysisBoardStatus, number>;

  return {
    asOf,
    summary: {
      counts,
      overdue: records.filter(
        (record) => dueBadge(record.dueDate, record.status, asOf) === "overdue",
      ).length,
      dueThisWeek: records.filter((record) =>
        isDueThisWeek(record.dueDate, record.status, asOf),
      ).length,
      averageApprovalDays: averageApprovalDays(records),
    },
  };
}

function boardAsOf(): string {
  return isDemoData()
    ? DEMO_ANALYSIS_AS_OF
    : new Date().toISOString().slice(0, 10);
}

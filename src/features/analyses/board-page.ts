import "server-only";

import { io } from "next/cache";

import { isDemoData } from "@/config/demo";
import {
  analysisStatusSchema,
  analysisSummarySchema,
  idSchema,
  type AnalysisStatus,
  type AnalysisSummary,
  type Engineer,
} from "@/schemas";

import { type AnalysisBoardRecord } from "./board";
import {
  DEMO_ACTOR,
  DEMO_ANALYSIS_AS_OF,
  DEMO_ENGINEERS,
  findDemoAnalysis,
  listDemoAnalyses,
} from "./board-demo";
import { averageApprovalDays, dueBadge } from "./timing";

/**
 * Analyses for the list and dashboard.
 * Rows render only when `isDemoData()` is on.
 */
export async function listAnalysisBoard(filters?: {
  status?: AnalysisStatus;
}): Promise<{ records: AnalysisBoardRecord[]; asOf: string }> {
  await io();
  const asOf = boardAsOf();
  if (!isDemoData()) {
    return { records: [], asOf };
  }
  const records = listDemoAnalyses().filter(
    (record) =>
      filters?.status === undefined ||
      record.analysis.status === filters.status,
  );
  return { records: [...records], asOf };
}

/** Null when demo mode is off or the id is unknown. */
export async function getAnalysisBoard(id: string): Promise<{
  record: AnalysisBoardRecord;
  asOf: string;
  actor: Engineer;
  directory: readonly Engineer[];
} | null> {
  await io();
  if (!idSchema.safeParse(id).success || !isDemoData()) {
    return null;
  }
  const record = findDemoAnalysis(id);
  if (!record) {
    return null;
  }
  return {
    record,
    asOf: boardAsOf(),
    actor: DEMO_ACTOR,
    directory: DEMO_ENGINEERS,
  };
}

export async function analysisBoardSummary(): Promise<{
  summary: AnalysisSummary;
  asOf: string;
}> {
  const { records, asOf } = await listAnalysisBoard();
  const counts = Object.fromEntries(
    analysisStatusSchema.options.map((status) => [
      status,
      records.filter((record) => record.analysis.status === status).length,
    ]),
  ) as AnalysisSummary["counts"];

  return {
    asOf,
    summary: analysisSummarySchema.parse({
      counts,
      overdue: records.filter(
        (record) =>
          dueBadge(record.analysis.dueDate, record.analysis.status, asOf) ===
          "overdue",
      ).length,
      dueSoon: records.filter(
        (record) =>
          dueBadge(record.analysis.dueDate, record.analysis.status, asOf) ===
          "due-soon",
      ).length,
      avgDaysToApproval: averageApprovalDays(
        records.map((record) => record.analysis),
      ),
    }),
  };
}

function boardAsOf(): string {
  return isDemoData()
    ? DEMO_ANALYSIS_AS_OF
    : new Date().toISOString().slice(0, 10);
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { AnalysisBoardList } from "@/components/analyses/analysis-board-list";
import { ANALYSIS_BOARD_STATUSES } from "@/features/analyses/board";
import { listAnalysisBoard } from "@/features/analyses/board-page";
import type { AnalysisStatus } from "@/schemas";

export const metadata: Metadata = {
  title: "Analyses",
};

export default function AnalysesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-body text-ink-muted">Loading analyses…</p>}
    >
      <AnalysesLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function AnalysesLoader({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = ANALYSIS_BOARD_STATUSES.find((value) => value === raw);
  const { records, asOf } = await listAnalysisBoard(
    status ? { status: status satisfies AnalysisStatus } : undefined,
  );

  return <AnalysisBoardList records={records} asOf={asOf} status={status} />;
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { AnalysisBoardCards } from "@/components/analyses/analysis-board-cards";
import { AnalysisSummaryLive } from "@/components/analyses/analysis-summary-live";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { isDemoData } from "@/config/demo";
import { analysisBoardSummary } from "@/features/analyses/board-page";
import { getDashboards } from "@/features/dashboard/data";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <Suspense
      fallback={<p className="text-body text-ink-muted">Loading dashboard…</p>}
    >
      <DashboardLoader />
    </Suspense>
  );
}

async function DashboardLoader() {
  const periods = await getDashboards();
  const cards = isDemoData() ? (
    <AnalysisBoardCards summary={(await analysisBoardSummary()).summary} />
  ) : (
    <AnalysisSummaryLive />
  );

  return (
    <div className="flex flex-col gap-6">
      {cards}
      <DashboardView
        periods={periods}
        marginThreshold={periods["30D"].marginThreshold}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { AnalysesView } from "@/components/analyses/analyses-view";
import { getAnalysesPage } from "@/features/analyses/data";
import { DEFAULT_ANALYSIS_ID } from "@/features/analyses/fixtures";

export const metadata: Metadata = {
  title: "Analyses",
};

export default function AnalysesPage() {
  return (
    <Suspense
      fallback={<p className="text-body text-ink-muted">Loading analyses…</p>}
    >
      <AnalysesLoader />
    </Suspense>
  );
}

async function AnalysesLoader() {
  const { records, asOf, marginThreshold } = await getAnalysesPage();

  return (
    <AnalysesView
      records={records}
      defaultSelectedId={DEFAULT_ANALYSIS_ID}
      marginThreshold={marginThreshold}
      asOf={asOf}
    />
  );
}

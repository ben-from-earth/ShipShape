import type { Metadata } from "next";
import { Suspense } from "react";

import { AnalysesView } from "@/components/analyses/analyses-view";
import { listAnalyses } from "@/features/analyses/data";
import { DEFAULT_ANALYSIS_ID } from "@/features/analyses/fixtures";
import { getLowMarginThreshold } from "@/lib/org-threshold";

export const metadata: Metadata = {
  title: "Engineering",
};

export default function EngineeringPage() {
  return (
    <Suspense
      fallback={<p className="text-body text-ink-muted">Loading analyses…</p>}
    >
      <EngineeringLoader />
    </Suspense>
  );
}

async function EngineeringLoader() {
  const [records, marginThreshold] = await Promise.all([
    listAnalyses(),
    getLowMarginThreshold(),
  ]);

  return (
    <AnalysesView
      records={records}
      defaultSelectedId={DEFAULT_ANALYSIS_ID}
      marginThreshold={marginThreshold}
    />
  );
}

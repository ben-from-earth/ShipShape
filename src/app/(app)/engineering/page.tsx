import type { Metadata } from "next";

import { AnalysesView } from "@/components/analyses/analyses-view";
import { listAnalyses } from "@/features/analyses/data";
import { DEFAULT_ANALYSIS_ID } from "@/features/analyses/fixtures";

export const metadata: Metadata = {
  title: "Engineering",
};

export default async function EngineeringPage() {
  const records = await listAnalyses();

  return (
    <AnalysesView records={records} defaultSelectedId={DEFAULT_ANALYSIS_ID} />
  );
}

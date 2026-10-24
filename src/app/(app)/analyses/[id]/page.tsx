import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AnalysisRecordView } from "@/components/analyses/analysis-record";
import { getAnalysisPage } from "@/features/analyses/page";
import { getLowMarginThreshold } from "@/lib/org-threshold";
import { idSchema } from "@/schemas";

export const metadata: Metadata = {
  title: "Analysis",
};

export default function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={<p className="text-body text-ink-muted">Loading analysis…</p>}
    >
      <AnalysisLoader params={params} />
    </Suspense>
  );
}

async function AnalysisLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    notFound();
  }

  const [record, marginThreshold] = await Promise.all([
    getAnalysisPage(id),
    getLowMarginThreshold(),
  ]);
  if (!record) {
    notFound();
  }

  return (
    <AnalysisRecordView record={record} marginThreshold={marginThreshold} />
  );
}

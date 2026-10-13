import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AnalysisRecordView } from "@/components/analyses/analysis-record";
import { getAnalysisPage } from "@/features/analyses/page";
import { listAnalysisReviews } from "@/features/analyses/reviews";
import { getLowMarginThreshold } from "@/features/dashboard/data";

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
  const [record, marginThreshold, reviews] = await Promise.all([
    getAnalysisPage(id),
    getLowMarginThreshold(),
    listAnalysisReviews(id),
  ]);

  if (!record) {
    notFound();
  }

  return (
    <AnalysisRecordView
      record={record}
      marginThreshold={marginThreshold}
      reviews={reviews}
    />
  );
}

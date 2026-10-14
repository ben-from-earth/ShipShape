import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AnalysisBoardDetail } from "@/components/analyses/analysis-board-detail";
import { getAnalysisBoard } from "@/features/analyses/board-page";

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
  const page = await getAnalysisBoard(id);
  if (!page) {
    notFound();
  }

  return (
    <AnalysisBoardDetail
      record={page.record}
      asOf={page.asOf}
      role={page.role}
    />
  );
}

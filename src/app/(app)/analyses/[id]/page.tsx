import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AnalysisBoardDetail } from "@/components/analyses/analysis-board-detail";
import { AnalysisBoardLiveDetail } from "@/components/analyses/analysis-board-live";
import { isDemoData } from "@/config/demo";
import { getAnalysisBoard } from "@/features/analyses/board-page";
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
  if (!isDemoData()) {
    if (!idSchema.safeParse(id).success) {
      notFound();
    }
    return <AnalysisBoardLiveDetail id={id} />;
  }
  const page = await getAnalysisBoard(id);
  if (!page) {
    notFound();
  }

  return (
    <AnalysisBoardDetail
      record={page.record}
      asOf={page.asOf}
      actor={page.actor}
      directory={page.directory}
    />
  );
}

"use client";

import { useEffect, useState } from "react";

import {
  BoardApiError,
  fetchAnalysisSummary,
} from "@/features/analyses/board-api";
import type { AnalysisSummary } from "@/schemas";

import { AnalysisBoardCards } from "./analysis-board-cards";

type SummaryResult = {
  summary: AnalysisSummary | null;
  error: string | null;
};

/** Dashboard cards from GET /api/analyses/summary. Demo mode does not render this. */
export function AnalysisSummaryLive() {
  const [result, setResult] = useState<SummaryResult | null>(null);

  useEffect(() => {
    let cancel = false;
    void fetchAnalysisSummary()
      .then((summary) => {
        if (!cancel) {
          setResult({ summary, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancel) {
          setResult({
            summary: null,
            error:
              error instanceof BoardApiError
                ? error.message
                : "Could not load analyses.",
          });
        }
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (!result) {
    return <p className="text-body text-ink-muted">Loading analyses…</p>;
  }
  if (result.error || !result.summary) {
    return (
      <p className="text-body text-accent" role="status">
        {result.error ?? "Could not load analyses."}
      </p>
    );
  }
  return <AnalysisBoardCards summary={result.summary} />;
}

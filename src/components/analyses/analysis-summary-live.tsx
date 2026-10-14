"use client";

import { useEffect, useState } from "react";

import {
  BoardApiError,
  analysisStatusMessage,
  fetchAnalysisSummary,
} from "@/features/analyses/board-api";
import { idSchema, type AnalysisSummary } from "@/schemas";

import { AnalysisBoardCards } from "./analysis-board-cards";
import { EngineerPicker, useDevEngineer } from "./engineer-picker";

type SummaryResult = {
  engineerId: string;
  summary: AnalysisSummary | null;
  error: string | null;
};

/** Dashboard cards from GET /api/analyses/summary. Demo mode does not render this. */
export function AnalysisSummaryLive() {
  const dev = useDevEngineer();
  const engineerId = dev.id.trim();
  const signedIn = idSchema.safeParse(engineerId).success;
  const [result, setResult] = useState<SummaryResult | null>(null);

  useEffect(() => {
    if (!signedIn) {
      return;
    }
    let cancel = false;
    void fetchAnalysisSummary(engineerId)
      .then((summary) => {
        if (!cancel) {
          setResult({ engineerId, summary, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancel) {
          setResult({
            engineerId,
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
  }, [engineerId, signedIn]);

  const current = result?.engineerId === engineerId ? result : null;
  const notice = signedIn
    ? (current?.error ?? null)
    : analysisStatusMessage(401);

  return (
    <div className="flex flex-col gap-6">
      <EngineerPicker id={dev.id} role={dev.role} onChange={dev.update} />
      {notice ? (
        <p className="text-body text-accent" role="status">
          {notice}
        </p>
      ) : null}
      {signedIn && !current ? (
        <p className="text-body text-ink-muted">Loading analyses…</p>
      ) : current?.summary ? (
        <AnalysisBoardCards summary={current.summary} />
      ) : null}
    </div>
  );
}

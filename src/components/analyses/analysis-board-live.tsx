"use client";

import { useEffect, useState } from "react";

import { useEngineer } from "@/features/auth/session";
import {
  BoardApiError,
  fetchAnalysis,
  fetchAttachments,
  fetchComments,
  fetchEngineers,
  listBoardAnalyses,
} from "@/features/analyses/board-api";
import type { AnalysisBoardRecord } from "@/features/analyses/board";
import type { Analysis, AnalysisStatus, Engineer } from "@/schemas";

import { AnalysisBoardDetail } from "./analysis-board-detail";
import { AnalysisBoardList } from "./analysis-board-list";

type ListResult = {
  status: AnalysisStatus | undefined;
  records: AnalysisBoardRecord[];
  asOf: string;
  error: string | null;
};

export function AnalysisBoardLiveList({ status }: { status?: AnalysisStatus }) {
  const [result, setResult] = useState<ListResult | null>(null);

  useEffect(() => {
    let cancel = false;
    void listBoardAnalyses()
      .then((analyses) => {
        if (cancel) {
          return;
        }
        setResult({
          status,
          asOf: new Date().toISOString(),
          error: null,
          records: analyses
            .filter(
              (analysis) => status === undefined || analysis.status === status,
            )
            .map(toRecord),
        });
      })
      .catch((error: unknown) => {
        if (cancel) {
          return;
        }
        setResult({
          status,
          records: [],
          asOf: "",
          error: messageFrom(error, "Could not load analyses."),
        });
      });
    return () => {
      cancel = true;
    };
  }, [status]);

  const current = result?.status === status ? result : null;

  return (
    <div className="flex flex-col gap-6">
      {current?.error ? <Notice>{current.error}</Notice> : null}
      {current ? (
        <AnalysisBoardList
          records={current.records}
          asOf={current.asOf}
          status={status}
        />
      ) : (
        <p className="text-body text-ink-muted">Loading analyses…</p>
      )}
    </div>
  );
}

type DetailResult = {
  id: string;
  record: AnalysisBoardRecord | null;
  directory: readonly Engineer[];
  asOf: string;
  error: string | null;
};

export function AnalysisBoardLiveDetail({ id }: { id: string }) {
  const actor = useEngineer();
  const [result, setResult] = useState<DetailResult | null>(null);

  useEffect(() => {
    let cancel = false;
    void Promise.all([
      fetchAnalysis(id),
      fetchComments(id),
      fetchAttachments(id),
      fetchEngineers(),
    ])
      .then(([analysis, comments, attachments, engineers]) => {
        if (cancel) {
          return;
        }
        setResult({
          id,
          asOf: new Date().toISOString(),
          error: null,
          directory: engineers,
          record: {
            analysis,
            assignee:
              engineers.find(
                (engineer) => engineer.id === analysis.assigneeId,
              ) ?? null,
            comments,
            attachments,
          },
        });
      })
      .catch((error: unknown) => {
        if (cancel) {
          return;
        }
        setResult({
          id,
          record: null,
          directory: [],
          asOf: "",
          error: messageFrom(error, "Could not load analyses."),
        });
      });
    return () => {
      cancel = true;
    };
  }, [id]);

  const current = result?.id === id ? result : null;

  if (!current || !actor) {
    return current?.error ? (
      <Notice>{current.error}</Notice>
    ) : (
      <p className="text-body text-ink-muted">Loading analysis…</p>
    );
  }
  if (current.error || !current.record) {
    return <Notice>{current.error ?? "Could not load analyses."}</Notice>;
  }

  return (
    <AnalysisBoardDetail
      key={`${actor.id}:${current.record.analysis.updatedAt}`}
      record={current.record}
      asOf={current.asOf}
      actor={actor}
      directory={current.directory}
    />
  );
}

function toRecord(analysis: Analysis): AnalysisBoardRecord {
  return { analysis, assignee: null, comments: [], attachments: [] };
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof BoardApiError ? error.message : fallback;
}

function Notice({ children }: { children: string }) {
  return (
    <p className="text-body text-accent" role="status">
      {children}
    </p>
  );
}

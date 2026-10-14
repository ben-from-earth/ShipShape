"use client";

import { useEffect, useState } from "react";

import {
  BoardApiError,
  analysisStatusMessage,
  fetchAnalysis,
  fetchAttachments,
  fetchComments,
  listBoardAnalyses,
} from "@/features/analyses/board-api";
import type { AnalysisBoardRecord } from "@/features/analyses/board";
import {
  idSchema,
  type Analysis,
  type AnalysisStatus,
  type Engineer,
  type EngineerRole,
} from "@/schemas";

import { AnalysisBoardDetail } from "./analysis-board-detail";
import { AnalysisBoardList } from "./analysis-board-list";
import { EngineerPicker, useDevEngineer } from "./engineer-picker";

const PLACEHOLDER_CREATED_AT = "2026-01-01T00:00:00.000Z";

type ListResult = {
  engineerId: string;
  status: AnalysisStatus | undefined;
  records: AnalysisBoardRecord[];
  asOf: string;
  error: string | null;
};

export function AnalysisBoardLiveList({ status }: { status?: AnalysisStatus }) {
  const dev = useDevEngineer();
  const engineerId = dev.id.trim();
  const signedIn = idSchema.safeParse(engineerId).success;
  const [result, setResult] = useState<ListResult | null>(null);

  useEffect(() => {
    if (!signedIn) {
      return;
    }
    let cancel = false;
    void listBoardAnalyses(engineerId)
      .then((analyses) => {
        if (cancel) {
          return;
        }
        setResult({
          engineerId,
          status,
          asOf: new Date().toISOString().slice(0, 10),
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
          engineerId,
          status,
          records: [],
          asOf: "",
          error: messageFrom(error, "Could not load analyses."),
        });
      });
    return () => {
      cancel = true;
    };
  }, [engineerId, signedIn, status]);

  const current =
    result?.engineerId === engineerId && result.status === status
      ? result
      : null;
  const notice = signedIn
    ? (current?.error ?? null)
    : analysisStatusMessage(401);

  return (
    <div className="flex flex-col gap-6">
      <EngineerPicker id={dev.id} role={dev.role} onChange={dev.update} />
      {notice ? <Notice>{notice}</Notice> : null}
      {signedIn && !current ? (
        <p className="text-body text-ink-muted">Loading analyses…</p>
      ) : signedIn ? (
        <AnalysisBoardList
          records={current?.records ?? []}
          asOf={current?.asOf ?? ""}
          status={status}
        />
      ) : null}
    </div>
  );
}

type DetailResult = {
  engineerId: string;
  id: string;
  record: AnalysisBoardRecord | null;
  asOf: string;
  error: string | null;
};

export function AnalysisBoardLiveDetail({ id }: { id: string }) {
  const dev = useDevEngineer();
  const engineerId = dev.id.trim();
  const signedIn = idSchema.safeParse(engineerId).success;
  const [result, setResult] = useState<DetailResult | null>(null);

  useEffect(() => {
    if (!signedIn) {
      return;
    }
    let cancel = false;
    void Promise.all([
      fetchAnalysis(id, engineerId),
      fetchComments(id, engineerId),
      fetchAttachments(id, engineerId),
    ])
      .then(([analysis, comments, attachments]) => {
        if (cancel) {
          return;
        }
        setResult({
          engineerId,
          id,
          asOf: new Date().toISOString().slice(0, 10),
          error: null,
          record: { analysis, assignee: null, comments, attachments },
        });
      })
      .catch((error: unknown) => {
        if (cancel) {
          return;
        }
        setResult({
          engineerId,
          id,
          record: null,
          asOf: "",
          error: messageFrom(error, "Could not load analyses."),
        });
      });
    return () => {
      cancel = true;
    };
  }, [engineerId, signedIn, id]);

  const current =
    result?.engineerId === engineerId && result.id === id ? result : null;
  const notice = signedIn
    ? (current?.error ?? null)
    : analysisStatusMessage(401);

  return (
    <div className="flex flex-col gap-6">
      <EngineerPicker id={dev.id} role={dev.role} onChange={dev.update} />
      {notice ? <Notice>{notice}</Notice> : null}
      {current?.record ? (
        <AnalysisBoardDetail
          key={`${engineerId}:${current.record.analysis.updatedAt}`}
          record={current.record}
          asOf={current.asOf}
          actor={actorFrom(engineerId, dev.role)}
          directory={[]}
        />
      ) : signedIn && !current ? (
        <p className="text-body text-ink-muted">Loading analysis…</p>
      ) : null}
    </div>
  );
}

function actorFrom(id: string, role: EngineerRole): Engineer {
  return {
    id,
    name: "Engineer",
    email: "engineer@example.com",
    role,
    createdAt: PLACEHOLDER_CREATED_AT,
  };
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

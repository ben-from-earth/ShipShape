"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { PageHeading } from "@/components/shell/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { isDemoData } from "@/config/demo";
import {
  addAnalysisComment,
  BoardApiError,
  fetchAnalysis,
  transitionAnalysis,
  uploadAnalysisAttachment,
} from "@/features/analyses/board-api";
import {
  ANALYSIS_ACTION_LABEL,
  ANALYSIS_STATUS_LABEL,
  attachmentLabel,
  canAttempt,
  movesFrom,
  type AnalysisBoardRecord,
} from "@/features/analyses/board";
import { ageDays } from "@/features/analyses/timing";
import { formatFindingDate } from "@/features/findings/display";
import {
  ANALYSIS_TRANSITIONS,
  type AnalysisAction,
  type AnalysisStatus,
  type Engineer,
} from "@/schemas";

import { DueBadge } from "./due-badge";

const TONE = {
  unassigned: "neutral",
  assigned: "navy",
  in_progress: "navy",
  waiting_for_review: "warn",
  in_review: "warn",
  approved: "ok",
} as const;

const inputClass =
  "min-h-11 w-full border border-line-strong bg-surface px-3 py-2 text-base text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const DEMO_ASSIGNEE_ID = "10000000-0000-4000-8000-000000000071";

/**
 * Detail for one analysis.
 * Demo mode updates the page locally. Otherwise moves, comments, and
 * uploads call the analyses routes with `x-engineer-id`.
 */
export function AnalysisBoardDetail({
  record,
  asOf,
  actor,
  directory,
}: {
  record: AnalysisBoardRecord;
  asOf: string;
  actor: Engineer;
  directory: readonly Engineer[];
}) {
  const row = record.analysis;
  const [status, setStatus] = useState<AnalysisStatus>(row.status);
  const [assigneeId, setAssigneeId] = useState(row.assigneeId);
  const [approvedAt, setApprovedAt] = useState(row.approvedAt);
  const [attachments, setAttachments] = useState([...record.attachments]);
  const [comments, setComments] = useState([...record.comments]);
  const [comment, setComment] = useState("");
  const [assigneeDraft, setAssigneeDraft] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const assigneeName =
    directory.find((engineer) => engineer.id === assigneeId)?.name ??
    assigneeId ??
    "—";
  const moves = movesFrom(status);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeading
        eyebrow="Analysis"
        title={row.code}
        actions={
          <Button href="/analyses" variant="subtle" size="sm">
            All analyses
          </Button>
        }
      />
      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-card-title font-semibold text-pretty">
            {row.title}
          </h2>
          <StatusPill
            label={ANALYSIS_STATUS_LABEL[status]}
            tone={TONE[status]}
          />
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Assignee">{assigneeName}</Fact>
          <Fact label="Created">{formatFindingDate(row.createdAt)}</Fact>
          <Fact label="Due">
            <span className="flex flex-wrap items-center gap-2">
              {row.dueDate ? formatFindingDate(row.dueDate) : "—"}
              <DueBadge dueDate={row.dueDate} status={status} asOf={asOf} />
            </span>
          </Fact>
          <Fact label="Approved">
            {approvedAt ? formatFindingDate(approvedAt) : "—"}
          </Fact>
          <Fact label="Age">{ageDays(row.createdAt, asOf)}d</Fact>
        </dl>
        {moves.includes("assign") && !isDemoData() ? (
          <label
            className="flex flex-col gap-1 text-ui font-medium"
            htmlFor="analysis-assignee"
          >
            Assignee
            <input
              id="analysis-assignee"
              value={assigneeDraft}
              autoComplete="off"
              spellCheck={false}
              className={inputClass}
              onChange={(event) => {
                setAssigneeDraft(event.target.value);
              }}
            />
          </label>
        ) : null}
        {notice ? (
          <p className="text-body text-accent" role="status">
            {notice}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {moves.map((action) => {
            const allowed = canAttempt(
              actor.role,
              action,
              actor.id,
              assigneeId,
            );
            return (
              <Button
                key={action}
                type="button"
                variant={action === "approve" ? "dark" : "subtle"}
                className="min-h-11"
                disabled={!allowed || pending}
                onClick={() => {
                  void runMove(action, allowed);
                }}
              >
                {ANALYSIS_ACTION_LABEL[action]}
              </Button>
            );
          })}
        </div>
      </Card>

      <Card className="flex flex-col gap-3 bg-paper-raised p-4 sm:p-6">
        <h2 className="text-card-title font-semibold">Attachments</h2>
        {attachments.length === 0 ? (
          <p className="text-body text-ink-muted">No attachments.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {attachments.map((file) => (
              <li key={file.id} className="text-body">
                {attachmentLabel(file)}
              </li>
            ))}
          </ul>
        )}
        <label className="text-ui font-medium" htmlFor="analysis-attachment">
          Upload
          <input
            id="analysis-attachment"
            type="file"
            className="mt-2 block text-body"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) {
                return;
              }
              void runUpload(file);
            }}
          />
        </label>
      </Card>

      <Card className="flex flex-col gap-3 bg-paper-raised p-4 sm:p-6">
        <h2 className="text-card-title font-semibold">Comments</h2>
        {comments.length === 0 ? (
          <p className="text-body text-ink-muted">No comments.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1">
                <span className="text-ui font-medium">
                  {directory.find((engineer) => engineer.id === entry.authorId)
                    ?.name ??
                    entry.authorId ??
                    "—"}
                </span>
                <p className="text-body text-pretty">{entry.body}</p>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-col gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            const body = comment.trim();
            if (!body) {
              return;
            }
            void runComment(body);
          }}
        >
          <label htmlFor="analysis-comment" className="text-ui font-medium">
            Add comment
          </label>
          <textarea
            id="analysis-comment"
            value={comment}
            rows={3}
            className={inputClass}
            onChange={(event) => {
              setComment(event.target.value);
            }}
          />
          <Button type="submit" variant="dark" className="min-h-11 self-start">
            Add comment
          </Button>
        </form>
      </Card>
    </div>
  );

  async function runMove(action: AnalysisAction, allowed: boolean) {
    if (!allowed || pending) {
      return;
    }
    setNotice(null);
    if (isDemoData()) {
      setStatus(ANALYSIS_TRANSITIONS[action].to);
      if (action === "assign") {
        setAssigneeId(DEMO_ASSIGNEE_ID);
      }
      if (action === "approve") {
        setApprovedAt(new Date().toISOString());
      }
      return;
    }

    setPending(true);
    try {
      const next = await transitionAnalysis(row.id, actor.id, {
        action,
        ...(action === "assign" ? { assigneeId: assigneeDraft.trim() } : {}),
      });
      setStatus(next.status);
      setAssigneeId(next.assigneeId);
      setApprovedAt(next.approvedAt);
    } catch (error) {
      setNotice(noticeFrom(error));
      if (
        error instanceof BoardApiError &&
        (error.status === 409 || error.status === 404)
      ) {
        await reloadAnalysis();
      }
    } finally {
      setPending(false);
    }
  }

  async function runComment(body: string) {
    setNotice(null);
    if (isDemoData()) {
      setComments((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          analysisId: row.id,
          authorId: actor.id,
          body,
          createdAt: new Date().toISOString(),
        },
      ]);
      setComment("");
      return;
    }

    setPending(true);
    try {
      const saved = await addAnalysisComment(row.id, actor.id, body);
      setComments((current) => [...current, saved]);
      setComment("");
    } catch (error) {
      setNotice(noticeFrom(error));
    } finally {
      setPending(false);
    }
  }

  async function runUpload(file: File) {
    setNotice(null);
    if (isDemoData()) {
      setAttachments((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          analysisId: row.id,
          uploadedBy: actor.id,
          createdAt: new Date().toISOString(),
          fileName: file.name,
          url: "https://example.com/upload",
          contentType: file.type || "application/octet-stream",
          size: file.size,
        },
      ]);
      return;
    }

    setPending(true);
    try {
      const saved = await uploadAnalysisAttachment(row.id, actor.id, file);
      setAttachments((current) => [...current, saved]);
    } catch (error) {
      setNotice(noticeFrom(error));
    } finally {
      setPending(false);
    }
  }

  async function reloadAnalysis() {
    try {
      const fresh = await fetchAnalysis(row.id, actor.id);
      setStatus(fresh.status);
      setAssigneeId(fresh.assigneeId);
      setApprovedAt(fresh.approvedAt);
    } catch {
      // The failed action already set the inline message.
    }
  }
}

function noticeFrom(error: unknown): string {
  return error instanceof BoardApiError
    ? error.message
    : "Could not update the analysis.";
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-ui font-medium text-ink-muted">{label}</dt>
      <dd className="text-body">{children}</dd>
    </div>
  );
}

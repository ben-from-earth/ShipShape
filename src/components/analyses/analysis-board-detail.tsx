"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { PageHeading } from "@/components/shell/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { isDemoData } from "@/config/demo";
import {
  ANALYSIS_ACTION_LABEL,
  ANALYSIS_STATUS_LABEL,
  canPerform,
  transitionsFrom,
  type AnalysisBoardRecord,
  type AnalysisBoardStatus,
  type BoardAttachment,
  type BoardComment,
  type EngineerRole,
} from "@/features/analyses/board";
import { formatFindingDate } from "@/features/findings/display";
import { ageDays } from "@/features/analyses/timing";

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

/**
 * Detail for one analysis. Actions, uploads, and comments stay local.
 * TODO: post with `x-engineer-id` once the routes exist.
 */
export function AnalysisBoardDetail({
  record,
  asOf,
  role,
}: {
  record: AnalysisBoardRecord;
  asOf: string;
  role: EngineerRole | null;
}) {
  const [status, setStatus] = useState<AnalysisBoardStatus>(record.status);
  const [assignee, setAssignee] = useState(record.assignee?.name ?? null);
  const [approvedAt, setApprovedAt] = useState(record.approvedAt);
  const [attachments, setAttachments] = useState<BoardAttachment[]>([
    ...record.attachments,
  ]);
  const [comments, setComments] = useState<BoardComment[]>([
    ...record.comments,
  ]);
  const [comment, setComment] = useState("");

  const moves = transitionsFrom(status);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeading
        eyebrow="Analysis"
        title={record.code}
        actions={
          <Button href="/analyses" variant="subtle" size="sm">
            All analyses
          </Button>
        }
      />
      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-card-title font-semibold text-pretty">
            {record.title}
          </h2>
          <StatusPill
            label={ANALYSIS_STATUS_LABEL[status]}
            tone={TONE[status]}
          />
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Assignee">{assignee ?? "—"}</Fact>
          <Fact label="Created">{formatFindingDate(record.createdAt)}</Fact>
          <Fact label="Due">
            <span className="flex flex-wrap items-center gap-2">
              {record.dueDate ? formatFindingDate(record.dueDate) : "—"}
              <DueBadge dueDate={record.dueDate} status={status} asOf={asOf} />
            </span>
          </Fact>
          <Fact label="Approved">
            {approvedAt ? formatFindingDate(approvedAt) : "—"}
          </Fact>
          <Fact label="Age">{ageDays(record.createdAt, asOf)}d</Fact>
        </dl>
        <div className="flex flex-wrap gap-2">
          {moves.map((move) => {
            const allowed = role != null && canPerform(role, move.action);
            return (
              <Button
                key={move.action}
                type="button"
                variant={move.action === "approve" ? "dark" : "subtle"}
                className="min-h-11"
                disabled={!allowed}
                onClick={() => {
                  if (!isDemoData() || !allowed) {
                    return;
                  }
                  setStatus(move.to);
                  if (move.action === "assign" && !assignee) {
                    setAssignee("Ada Analyst");
                  }
                  if (move.action === "approve") {
                    setApprovedAt(new Date().toISOString());
                  }
                }}
              >
                {ANALYSIS_ACTION_LABEL[move.action]}
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
                {file.name}
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
              if (!file || !isDemoData()) {
                return;
              }
              setAttachments((current) => [
                ...current,
                { id: crypto.randomUUID(), name: file.name },
              ]);
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
                <span className="text-ui font-medium">{entry.author}</span>
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
            if (!body || !isDemoData()) {
              return;
            }
            setComments((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                author: "Ren Reviewer",
                body,
                createdAt: new Date().toISOString(),
              },
            ]);
            setComment("");
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
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-ui font-medium text-ink-muted">{label}</dt>
      <dd className="text-body">{children}</dd>
    </div>
  );
}

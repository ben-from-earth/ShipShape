import Link from "next/link";

import { PageHeading } from "@/components/shell/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import {
  ANALYSIS_STATUS_LABEL,
  type AnalysisBoardRecord,
} from "@/features/analyses/board";
import { ageDays } from "@/features/analyses/timing";
import { formatFindingDate } from "@/features/findings/display";
import { analysisStatusSchema, type AnalysisStatus } from "@/schemas";

import { DueBadge } from "./due-badge";

const TONE = {
  unassigned: "neutral",
  assigned: "navy",
  in_progress: "navy",
  waiting_for_review: "warn",
  in_review: "warn",
  approved: "ok",
} as const;

export function AnalysisBoardList({
  records,
  asOf,
  status,
}: {
  records: readonly AnalysisBoardRecord[];
  asOf: string;
  status?: AnalysisStatus;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Analyses" title="Analyses" />
      <div className="flex flex-wrap gap-2">
        <FilterLink
          href="/analyses"
          label="All"
          active={status === undefined}
        />
        {analysisStatusSchema.options.map((value) => (
          <FilterLink
            key={value}
            href={`/analyses?status=${value}`}
            label={ANALYSIS_STATUS_LABEL[value]}
            active={status === value}
          />
        ))}
      </div>
      {records.length === 0 ? (
        <p className="text-body text-ink-muted">No analyses.</p>
      ) : (
        <div className="overflow-x-auto border border-line">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <thead className="bg-paper-raised text-ui text-ink-muted">
              <tr>
                {["Code", "Title", "Assignee", "Status", "Due", "Age"].map(
                  (heading) => (
                    <th key={heading} className="px-3 py-2 font-medium">
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const row = record.analysis;
                return (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-3 py-3 font-mono text-ui">
                      <Link
                        href={`/analyses/${row.id}`}
                        className="text-ink no-underline hover:text-accent"
                      >
                        {row.code}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-body">{row.title}</td>
                    <td className="px-3 py-3 text-body">
                      {record.assignee?.name ?? row.assigneeId ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill
                        label={ANALYSIS_STATUS_LABEL[row.status]}
                        tone={TONE[row.status]}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex flex-wrap items-center gap-2 text-body">
                        {row.dueDate ? formatFindingDate(row.dueDate) : "—"}
                        <DueBadge
                          dueDate={row.dueDate}
                          status={row.status}
                          asOf={asOf}
                        />
                      </span>
                    </td>
                    <td className="px-3 py-3 text-body">
                      {ageDays(row.createdAt, asOf)}d
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "border border-ink bg-ink px-3 py-2 text-ui text-white no-underline"
          : "border border-line-strong bg-surface px-3 py-2 text-ui text-ink no-underline hover:border-ink"
      }
    >
      {label}
    </Link>
  );
}

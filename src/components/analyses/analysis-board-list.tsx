import Link from "next/link";

import { PageHeading } from "@/components/shell/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import {
  ANALYSIS_BOARD_STATUSES,
  ANALYSIS_STATUS_LABEL,
  type AnalysisBoardRecord,
  type AnalysisBoardStatus,
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

export function AnalysisBoardList({
  records,
  asOf,
  status,
}: {
  records: readonly AnalysisBoardRecord[];
  asOf: string;
  status?: AnalysisBoardStatus;
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
        {ANALYSIS_BOARD_STATUSES.map((value) => (
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
              {records.map((record) => (
                <tr key={record.id} className="border-t border-line">
                  <td className="px-3 py-3 font-mono text-ui">
                    <Link
                      href={`/analyses/${record.id}`}
                      className="text-ink no-underline hover:text-accent"
                    >
                      {record.code}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-body">{record.title}</td>
                  <td className="px-3 py-3 text-body">
                    {record.assignee?.name ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <StatusPill
                      label={ANALYSIS_STATUS_LABEL[record.status]}
                      tone={TONE[record.status]}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex flex-wrap items-center gap-2 text-body">
                      {record.dueDate ? formatFindingDate(record.dueDate) : "—"}
                      <DueBadge
                        dueDate={record.dueDate}
                        status={record.status}
                        asOf={asOf}
                      />
                    </span>
                  </td>
                  <td className="px-3 py-3 text-body">
                    {ageDays(record.createdAt, asOf)}d
                  </td>
                </tr>
              ))}
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

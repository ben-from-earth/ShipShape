import Link from "next/link";

import { PageHeading } from "@/components/shell/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatFindingDate } from "@/features/findings/display";
import {
  REPAIR_STATUS_LABEL,
  REPAIR_STATUS_OPTIONS,
} from "@/features/repairs/display";
import type { RepairView } from "@/features/repairs/view";
import type { RepairListFilters } from "@/schemas";

import { RepairStatusPill } from "./status-pill";

const selectClass =
  "min-h-11 w-full border border-line-strong bg-surface px-3 py-2 text-base text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

function assetLine(record: RepairView): string {
  if (!record.assetIdentifier) {
    return "—";
  }
  return record.assetName
    ? `${record.assetIdentifier} · ${record.assetName}`
    : record.assetIdentifier;
}

export function RepairsList({
  records,
  filters,
}: {
  records: readonly RepairView[];
  filters: RepairListFilters;
}) {
  const filtered =
    filters.status !== undefined || filters.findingId !== undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Opened work" title="Repairs" />

      <Card className="bg-paper-raised p-4 sm:p-6">
        <form method="get" action="/repairs" className="flex flex-col gap-4">
          {filters.findingId ? (
            <input type="hidden" name="findingId" value={filters.findingId} />
          ) : null}
          <label
            className="flex max-w-xs flex-col gap-2"
            htmlFor="repair-filter-status"
          >
            <span className="text-ui font-medium">Status</span>
            <select
              id="repair-filter-status"
              name="status"
              defaultValue={filters.status ?? ""}
              className={selectClass}
            >
              <option value="">All statuses</option>
              {REPAIR_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {REPAIR_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" size="sm">
              Apply
            </Button>
            <Button href="/repairs" variant="subtle" size="sm">
              Clear
            </Button>
          </div>
        </form>
      </Card>

      {records.length === 0 ? (
        <Card className="bg-paper-raised p-4 sm:p-6">
          <p className="text-body text-ink-muted">
            {filtered ? "No repairs match these filters." : "No repairs yet."}
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col border border-line bg-surface">
          <li className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto_auto] gap-3 border-b border-line px-4 py-2 text-ui text-ink-muted sm:grid">
            <span>Code</span>
            <span>Finding</span>
            <span>Asset</span>
            <span>Status</span>
            <span>Created</span>
          </li>
          {records.map((record) => (
            <li
              key={record.id}
              className="border-b border-line-faint last:border-b-0"
            >
              <Link
                href={`/repairs/${record.id}`}
                className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 text-ink no-underline hover:bg-sunken sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto_auto] sm:items-center"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-mono text-ui font-medium">
                    {record.code}
                  </span>
                  <span className="truncate text-body text-ink-muted">
                    {record.title}
                  </span>
                </span>
                <span className="font-mono text-ui">
                  {record.findingCode ?? "—"}
                </span>
                <span className="truncate text-ui">{assetLine(record)}</span>
                <RepairStatusPill status={record.status} />
                <time
                  dateTime={record.createdAt}
                  className="text-body text-ink-muted"
                >
                  {formatFindingDate(record.createdAt)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

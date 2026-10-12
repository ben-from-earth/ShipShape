import Link from "next/link";

import { PageHeading } from "@/components/shell/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { SEVERITIES } from "@/config/severity";
import {
  FINDING_STAGES,
  STAGE_LABEL,
  formatFindingDate,
} from "@/features/findings/display";
import type { FindingListFilters, FindingRecord } from "@/schemas";

import { SeverityPill } from "./severity-pill";

const selectClass =
  "min-h-11 w-full border border-line-strong bg-surface px-3 py-2 text-base text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export type FindingAssetOption = {
  id: string;
  identifier: string;
  name: string | null;
};

export function FindingsList({
  records,
  assets,
  filters,
}: {
  records: readonly FindingRecord[];
  assets: readonly FindingAssetOption[];
  filters: FindingListFilters;
}) {
  const filtered =
    filters.stage !== undefined ||
    filters.severity !== undefined ||
    filters.assetId !== undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Field reports"
        title="Findings"
        actions={
          <Button href="/findings/new" variant="dark" size="sm">
            New finding
          </Button>
        }
      />

      <Card className="bg-paper-raised p-4 sm:p-6">
        <form method="get" action="/findings" className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label
              className="flex flex-col gap-2"
              htmlFor="finding-filter-stage"
            >
              <span className="text-ui font-medium">Stage</span>
              <select
                id="finding-filter-stage"
                name="stage"
                defaultValue={filters.stage ?? ""}
                className={selectClass}
              >
                <option value="">All stages</option>
                {FINDING_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABEL[stage]}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="flex flex-col gap-2"
              htmlFor="finding-filter-severity"
            >
              <span className="text-ui font-medium">Severity</span>
              <select
                id="finding-filter-severity"
                name="severity"
                defaultValue={filters.severity ?? ""}
                className={selectClass}
              >
                <option value="">All severities</option>
                {SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="flex flex-col gap-2"
              htmlFor="finding-filter-asset"
            >
              <span className="text-ui font-medium">Asset</span>
              <select
                id="finding-filter-asset"
                name="assetId"
                defaultValue={filters.assetId ?? ""}
                className={selectClass}
              >
                <option value="">All assets</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name
                      ? `${asset.identifier} · ${asset.name}`
                      : asset.identifier}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" size="sm">
              Apply
            </Button>
            <Button href="/findings" variant="subtle" size="sm">
              Clear
            </Button>
          </div>
        </form>
      </Card>

      {records.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 bg-paper-raised p-4 sm:p-6">
          <p className="text-body text-ink-muted">
            {filtered ? "No findings match these filters." : "No findings yet."}
          </p>
          <Button href="/findings/new" variant="dark" size="sm">
            New finding
          </Button>
        </Card>
      ) : (
        <ul className="flex flex-col border border-line bg-surface">
          <li className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto_auto_auto_auto] gap-3 border-b border-line px-4 py-2 text-ui text-ink-muted sm:grid">
            <span>Code</span>
            <span>Asset</span>
            <span>Severity</span>
            <span>Stage</span>
            <span>Created</span>
            <span>Photos</span>
          </li>
          {records.map((record) => (
            <li
              key={record.id}
              className="border-b border-line-faint last:border-b-0"
            >
              <Link
                href={`/findings/${record.id}`}
                className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 text-ink no-underline hover:bg-sunken sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto_auto_auto_auto] sm:items-center"
              >
                <span className="font-mono text-ui font-medium">
                  {record.code}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-ui">
                    {record.asset.identifier}
                  </span>
                  {record.asset.name ? (
                    <span className="truncate text-body text-ink-muted">
                      {record.asset.name}
                    </span>
                  ) : null}
                </span>
                <SeverityPill severity={record.severity} />
                <StatusPill label={STAGE_LABEL[record.stage]} tone="outline" />
                <time
                  dateTime={record.createdAt}
                  className="text-body text-ink-muted"
                >
                  {formatFindingDate(record.createdAt)}
                </time>
                <span className="font-mono text-ui">
                  {record.photos.length}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

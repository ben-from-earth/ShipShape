import type { ReactNode } from "react";

import Link from "next/link";

import { RepairStatusPill } from "@/components/repairs/status-pill";
import { PageHeading } from "@/components/shell/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { STAGE_LABEL, formatFindingDate } from "@/features/findings/display";
import type { RepairView } from "@/features/repairs/view";
import {
  findingLocationLine,
  findingZoneLine,
} from "@/features/findings/place";
import type { FindingRecord } from "@/schemas";

import { FindingPhoto } from "./finding-photo";
import { SeverityPill } from "./severity-pill";

export function FindingDetail({
  record,
  repairs,
}: {
  record: FindingRecord;
  repairs: readonly RepairView[];
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeading
        eyebrow="Finding"
        title={record.code}
        actions={
          <Button href="/findings" variant="subtle" size="sm">
            All findings
          </Button>
        }
      />

      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <p className="text-body text-pretty">{record.description}</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Severity">
            <SeverityPill severity={record.severity} />
          </Fact>
          <Fact label="Stage">
            <StatusPill label={STAGE_LABEL[record.stage]} tone="outline" />
          </Fact>
          <Fact label="Asset">
            <span className="text-body">
              {record.asset.identifier}
              {record.asset.name ? ` · ${record.asset.name}` : ""}
            </span>
          </Fact>
          <Fact label="Created">
            <time dateTime={record.createdAt} className="text-body">
              {formatFindingDate(record.createdAt)}
            </time>
          </Fact>
          <Fact label="Zone">
            <span className="text-body">{findingZoneLine(record.zone)}</span>
          </Fact>
          <Fact label="Location">
            <span className="text-body">
              {findingLocationLine({
                locationLabel: record.locationLabel,
                location: record.location,
              })}
            </span>
          </Fact>
        </dl>
      </Card>

      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <h2 className="text-card-title font-semibold">Repairs</h2>
        {repairs.length === 0 ? (
          <p className="text-body text-ink-muted">No repairs yet.</p>
        ) : (
          <ul className="flex flex-col border border-line bg-surface">
            {repairs.map((repair) => (
              <li
                key={repair.id}
                className="border-b border-line-faint last:border-b-0"
              >
                <Link
                  href={`/repairs/${repair.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-ink no-underline hover:bg-sunken"
                >
                  <span className="font-mono text-ui font-medium">
                    {repair.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body">
                    {repair.title}
                  </span>
                  <RepairStatusPill status={repair.status} />
                  <time
                    dateTime={repair.createdAt}
                    className="text-body text-ink-muted"
                  >
                    {formatFindingDate(repair.createdAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <h2 className="text-card-title font-semibold">Photos</h2>
        {record.photos.length === 0 ? (
          <p className="text-body text-ink-muted">No photos.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {record.photos.map((photo) => (
              <li key={photo.mediaId}>
                <FindingPhoto findingId={record.id} mediaId={photo.mediaId} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-ui font-medium text-ink-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

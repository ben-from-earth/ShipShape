import type { ReactNode } from "react";
import Link from "next/link";

import { CreateAnalysis } from "@/components/analyses/create-analysis";
import { PageHeading } from "@/components/shell/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import type { AnalysisRecord } from "@/features/analyses/types";
import { STATUS_LABEL } from "@/features/analyses/derive";
import { formatFindingDate } from "@/features/findings/display";
import { repairAssetLabel } from "@/features/repairs/display";
import type { Repair } from "@/schemas";

import { RepairStatusPill } from "./status-pill";

export function RepairDetail({
  record,
  analyses,
}: {
  record: Repair;
  analyses: readonly AnalysisRecord[];
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeading
        eyebrow="Repair"
        title={record.code}
        actions={
          <Button href="/repairs" variant="subtle" size="sm">
            All repairs
          </Button>
        }
      />

      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <p className="text-body text-pretty">{record.title}</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Status">
            <RepairStatusPill status={record.status} />
          </Fact>
          <Fact label="Type">
            <span className="text-body">{record.type ?? "—"}</span>
          </Fact>
          <Fact label="Issue">
            <Link
              href={`/issues/${record.finding.id}`}
              className="font-mono text-ui text-ink no-underline hover:text-accent"
            >
              {record.finding.code}
            </Link>
          </Fact>
          <Fact label="Asset">
            <span className="text-body">{repairAssetLabel(record.asset)}</span>
          </Fact>
          <Fact label="Created">
            <time dateTime={record.createdAt} className="text-body">
              {formatFindingDate(record.createdAt)}
            </time>
          </Fact>
          <Fact label="Updated">
            <time dateTime={record.updatedAt} className="text-body">
              {formatFindingDate(record.updatedAt)}
            </time>
          </Fact>
          <Fact label="Created by">
            <span className="font-mono text-body">
              {record.createdBy ?? "—"}
            </span>
          </Fact>
        </dl>
      </Card>

      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <CreateAnalysis repairId={record.id} />
        {analyses.length === 0 ? (
          <p className="text-body text-ink-muted">No analyses yet.</p>
        ) : (
          <ul className="flex flex-col border border-line bg-surface">
            {analyses.map((analysis) => (
              <li
                key={analysis.id}
                className="border-b border-line-faint last:border-b-0"
              >
                <Link
                  href={`/analyses/${analysis.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-ink no-underline hover:bg-sunken"
                >
                  <span className="min-w-0 flex-1 truncate text-body">
                    {analysis.title}
                  </span>
                  <StatusPill
                    label={STATUS_LABEL[analysis.status]}
                    tone="outline"
                  />
                </Link>
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

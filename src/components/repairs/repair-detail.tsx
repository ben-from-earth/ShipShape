import type { ReactNode } from "react";
import Link from "next/link";

import { PageHeading } from "@/components/shell/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatFindingDate } from "@/features/findings/display";
import { repairAssetLabel } from "@/features/repairs/display";
import type { Repair } from "@/schemas";

import { RepairStatusPill } from "./status-pill";

export function RepairDetail({ record }: { record: Repair }) {
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
          <Fact label="Finding">
            <Link
              href={`/findings/${record.finding.id}`}
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
      {/* TODO: the create-analysis form left this page. Wire a standalone create once the analyses contract lands. */}
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

import type { ReactNode } from "react";
import Link from "next/link";

import { PageHeading } from "@/components/shell/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import {
  ANALYSIS_PAGE_STATUS_LABEL,
  type AnalysisPageStatus,
  type AnalysisView,
} from "@/features/analyses/view";
import { idSchema } from "@/schemas";

import { LoadCaseMargins } from "./load-cases";

const STATUS_TONE: Record<
  AnalysisPageStatus,
  "neutral" | "navy" | "warn" | "accent" | "ok"
> = {
  draft: "neutral",
  in_progress: "navy",
  in_review: "warn",
  changes_requested: "accent",
  approved: "ok",
};

export function AnalysisRecordView({
  record,
  marginThreshold,
}: {
  record: AnalysisView;
  /** Organization cutoff passed in from the server page. */
  marginThreshold: number;
}) {
  const repairHref = recordHref("/repairs", record.repair.id);
  const findingHref = recordHref("/findings", record.finding.id);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeading
        eyebrow="Analysis"
        title={record.code}
        actions={
          <Button href="/engineering" variant="subtle" size="sm">
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
            label={ANALYSIS_PAGE_STATUS_LABEL[record.status]}
            tone={STATUS_TONE[record.status]}
          />
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Method">
            <span className="text-body">{record.method ?? "—"}</span>
          </Fact>
          <Fact label="Status">
            <span className="text-body">
              {ANALYSIS_PAGE_STATUS_LABEL[record.status]}
            </span>
          </Fact>
          <Fact label="Repair">
            <span className="flex flex-col gap-1">
              <RecordLink href={repairHref}>
                <span className="font-mono">{record.repair.code}</span>
                <span> · Rev {record.repair.revision}</span>
              </RecordLink>
              <span className="text-body text-ink-muted">
                {record.repair.title}
              </span>
            </span>
          </Fact>
          <Fact label="Finding">
            <RecordLink href={findingHref}>
              <span className="font-mono">{record.finding.code}</span>
            </RecordLink>
          </Fact>
        </dl>
      </Card>

      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <h2 className="text-card-title font-semibold">Load cases</h2>
        <LoadCaseMargins
          cases={record.loadCases}
          marginThreshold={marginThreshold}
        />
      </Card>
    </div>
  );
}

function recordHref(base: "/repairs" | "/findings", id: string): string | null {
  return idSchema.safeParse(id).success ? `${base}/${id}` : null;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-ui font-medium text-ink-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function RecordLink({
  href,
  children,
}: {
  href: string | null;
  children: ReactNode;
}) {
  if (!href) {
    return <span className="text-body text-ink">{children}</span>;
  }

  return (
    <Link
      href={href}
      className="text-body text-ink no-underline hover:text-accent"
    >
      {children}
    </Link>
  );
}

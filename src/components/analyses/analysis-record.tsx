import type { ReactNode } from "react";
import Link from "next/link";

import { PageHeading } from "@/components/shell/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import type { AnalysisDbStatus } from "@/config/analysis";
import { ANALYSIS_STATUS_LABEL } from "@/features/analyses/form";
import type { StoredAnalysis } from "@/features/analyses/stored";

import { LoadCaseMargins } from "./load-cases";

const STATUS_TONE: Record<
  AnalysisDbStatus,
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
  record: StoredAnalysis;
  /** Organization cutoff passed in from the server page. */
  marginThreshold: number;
}) {
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
            label={ANALYSIS_STATUS_LABEL[record.status]}
            tone={STATUS_TONE[record.status]}
          />
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Fact label="Method">
            <span className="text-body">{record.method ?? "—"}</span>
          </Fact>
          <Fact label="Status">
            <span className="text-body">
              {ANALYSIS_STATUS_LABEL[record.status]}
            </span>
          </Fact>
          <Fact label="Repair">
            <span className="flex flex-col gap-1">
              <Link
                href={`/repairs/${record.repairId}`}
                className="text-body text-ink no-underline hover:text-accent"
              >
                Repair
              </Link>
              <span className="text-body text-ink-muted">
                Rev {record.revision}
              </span>
            </span>
          </Fact>
          <Fact label="Due">
            <span className="text-body">{record.dueDate ?? "—"}</span>
          </Fact>
        </dl>
      </Card>

      <Card className="flex flex-col gap-4 bg-paper-raised p-4 sm:p-6">
        <h2 className="text-card-title font-semibold">Load case</h2>
        <LoadCaseMargins
          loadCase={record.loadCase}
          margin={record.margin}
          marginThreshold={marginThreshold}
        />
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

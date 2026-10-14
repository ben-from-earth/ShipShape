import { Card } from "@/components/ui/card";
import { ANALYSIS_STATUS_LABEL } from "@/features/analyses/board";
import { analysisStatusSchema, type AnalysisSummary } from "@/schemas";

export function AnalysisBoardCards({ summary }: { summary: AnalysisSummary }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-card-title font-semibold">Analyses</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {analysisStatusSchema.options.map((status) => (
          <Card
            key={status}
            className="flex flex-col gap-1 bg-paper-raised p-4"
          >
            <span className="text-ui text-ink-muted">
              {ANALYSIS_STATUS_LABEL[status]}
            </span>
            <span className="font-mono text-card-title font-semibold">
              {summary.counts[status]}
            </span>
          </Card>
        ))}
        <Card className="flex flex-col gap-1 bg-paper-raised p-4">
          <span className="text-ui text-ink-muted">Overdue</span>
          <span className="font-mono text-card-title font-semibold text-accent">
            {summary.overdue}
          </span>
        </Card>
        <Card className="flex flex-col gap-1 bg-paper-raised p-4">
          <span className="text-ui text-ink-muted">Due soon</span>
          <span className="font-mono text-card-title font-semibold text-warn">
            {summary.dueSoon}
          </span>
        </Card>
        <Card className="flex flex-col gap-1 bg-paper-raised p-4">
          <span className="text-ui text-ink-muted">Avg days to approval</span>
          <span className="font-mono text-card-title font-semibold">
            {summary.avgDaysToApproval ?? "—"}
          </span>
        </Card>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { PageHeading } from "@/components/shell/page-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarginValue } from "@/components/ui/margin-value";
import { LOW_MARGIN_THRESHOLD } from "@/config/analysis";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatusPill } from "@/components/ui/status-pill";
import type {
  AgeBucketId,
  AttentionFlag,
  DashboardModel,
  DashboardPeriod,
  DeltaTone,
  WorkStage,
} from "@/features/dashboard/types";
import { cn } from "@/lib/utils";

const PERIODS: readonly { value: DashboardPeriod; label: string }[] = [
  { value: "30D", label: "30D" },
  { value: "90D", label: "90D" },
  { value: "12M", label: "12M" },
];

const DELTA_CLASS: Record<DeltaTone, string> = {
  bad: "text-accent",
  good: "text-ok",
  neutral: "text-ink-muted",
};

const STAGE_BAR: Record<WorkStage, string> = {
  issue: "bg-accent",
  repair: "bg-id-brown",
  analyze: "bg-navy",
  approve: "bg-ok",
};

const AGE_BAR: Record<AgeBucketId, string> = {
  "0-7": "bg-line",
  "8-14": "bg-muted-warm",
  "15-30": "bg-id-slate",
  "30+": "bg-accent",
};

const FLAG_CLASS: Record<AttentionFlag, string> = {
  "negative-margin": "bg-accent text-white",
  overdue: "bg-accent text-white",
  "asset-down": "bg-ink text-white",
  "due-tomorrow": "bg-warn text-white",
  "low-margin": "bg-line-faint text-ink-3",
};

function percent(share: number): string {
  return `${share * 100}%`;
}

function PanelTitle({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <h2 className="text-card-title font-semibold">{title}</h2>
      {detail ? (
        <p className="text-[12.5px] whitespace-nowrap text-ink-muted">
          {detail}
        </p>
      ) : null}
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}

export function DashboardView({
  periods,
  marginThreshold = LOW_MARGIN_THRESHOLD,
}: {
  periods: Record<DashboardPeriod, DashboardModel>;
  /** Organization cutoff. Defaults to `LOW_MARGIN_THRESHOLD`. */
  marginThreshold?: number;
}) {
  const [period, setPeriod] = useState<DashboardPeriod>("30D");
  const model = periods[period] ?? periods["30D"];
  const throughputMax = Math.max(
    1,
    ...model.throughput.flatMap((point) => [point.opened, point.approved]),
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeading
        eyebrow={`Repair program · As of ${model.asOfLabel}`}
        title="Dashboard"
        actions={
          <>
            <Button href="/findings/new" variant="dark" size="sm">
              New finding
            </Button>
            <SegmentedControl
              label="Reporting period"
              value={period}
              options={PERIODS}
              onChange={setPeriod}
            />
          </>
        }
      />

      <section aria-label="Program summary">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
          {model.kpis.map((kpi) => (
            <li key={kpi.label}>
              <Card className="flex h-full flex-col gap-2 px-[18px] py-4">
                <p className="font-mono text-eyebrow tracking-eyebrow text-ink-muted uppercase">
                  {kpi.label}
                </p>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-kpi font-semibold">{kpi.value}</span>
                  {kpi.unit ? (
                    <span className="text-body text-ink-muted">{kpi.unit}</span>
                  ) : null}
                </p>
                <p
                  className={cn(
                    "font-mono text-caption",
                    DELTA_CLASS[kpi.deltaTone],
                  )}
                >
                  {kpi.delta}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-[18px] lg:grid-cols-2">
        <Card className="flex flex-col gap-4 px-5 py-[18px]">
          <PanelTitle
            title="Pipeline"
            detail="Open items by stage, median days in stage"
          />
          <ol className="grid grid-cols-4 gap-1">
            {model.pipeline.map((stage) => (
              <li key={stage.id} className="flex min-w-0 flex-col gap-2">
                <div className={cn("h-1.5", STAGE_BAR[stage.id])} />
                <p className="font-mono text-eyebrow tracking-eyebrow text-ink-muted uppercase">
                  {stage.step} · {stage.label}
                </p>
                <p className="text-stat font-semibold">{stage.count}</p>
                <p className="text-[12.5px] text-ink-3">
                  {stage.medianDays} d median
                </p>
                <p className={cn("text-xs", DELTA_CLASS[stage.noteTone])}>
                  {stage.note}
                </p>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-2 border-t border-line-faint pt-3.5">
            <p className="font-mono text-eyebrow tracking-eyebrow text-ink-muted uppercase">
              Cycle time, discovery → approval
            </p>
            <div className="flex h-[22px]" aria-hidden>
              {model.pipeline.map((stage) => (
                <div
                  key={stage.id}
                  className={cn(
                    "flex items-center overflow-hidden px-1.5 font-mono text-eyebrow whitespace-nowrap text-white",
                    STAGE_BAR[stage.id],
                  )}
                  style={{ width: percent(stage.share) }}
                >
                  {stage.medianDays}d
                </div>
              ))}
            </div>
            <table className="sr-only">
              <caption>Median days from discovery to approval</caption>
              <thead>
                <tr>
                  <th scope="col">Stage</th>
                  <th scope="col">Open items</th>
                  <th scope="col">Median days</th>
                </tr>
              </thead>
              <tbody>
                {model.pipeline.map((stage) => (
                  <tr key={stage.id}>
                    <th scope="row">{stage.label}</th>
                    <td>{stage.count}</td>
                    <td>{stage.medianDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="flex flex-col gap-4 px-5 py-[18px]">
          <PanelTitle
            title="Throughput"
            detail={model.throughputSubtitle}
            action={
              <ul className="flex gap-3.5 text-xs text-ink-3">
                <li className="flex items-center gap-1.5">
                  <span className="size-2.5 bg-accent" aria-hidden />
                  Opened
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-2.5 bg-ink" aria-hidden />
                  Approved
                </li>
              </ul>
            }
          />
          <div
            className="flex h-[170px] items-end gap-1.5 border-b border-ink"
            aria-hidden
          >
            {model.throughput.map((point, index) => (
              <div
                key={`${point.label}-${index}`}
                className="flex h-full min-w-0 flex-1 items-end gap-0.5"
              >
                <div
                  className="min-h-0 flex-1 bg-accent"
                  style={{
                    height: percent(point.opened / throughputMax),
                  }}
                />
                <div
                  className="min-h-0 flex-1 bg-ink"
                  style={{
                    height: percent(point.approved / throughputMax),
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-[-10px] flex gap-1.5" aria-hidden>
            {model.throughput.map((point, index) => (
              <div
                key={`${point.label}-${index}`}
                className="flex-1 text-center font-mono text-2xs text-ink-faint"
              >
                {point.label || "\u00a0"}
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>Throughput, {model.throughputSubtitle}</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Opened</th>
                <th scope="col">Approved</th>
              </tr>
            </thead>
            <tbody>
              {model.throughput.map((point, index) => (
                <tr key={`${point.label}-${index}`}>
                  <th scope="row">{point.label || `Bucket ${index + 1}`}</th>
                  <td>{point.opened}</td>
                  <td>{point.approved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid gap-[18px] lg:grid-cols-3">
        <Card className="flex flex-col gap-3.5 px-5 py-[18px]">
          <PanelTitle
            title="Findings by zone"
            action={
              <Link
                href="/docs"
                className="text-[12.5px] whitespace-nowrap text-navy no-underline hover:text-accent"
              >
                Open map
              </Link>
            }
          />
          <ol className="flex flex-col gap-2.5">
            {model.zones.map((zone) => (
              <li
                key={zone.name}
                className="grid grid-cols-[minmax(90px,120px)_minmax(0,1fr)_28px] items-center gap-2.5 text-body"
              >
                <span className="text-ink-2">{zone.name}</span>
                <div className="h-2.5 bg-paper" aria-hidden>
                  <div
                    className={cn(
                      "h-full",
                      zone.highlighted ? "bg-accent" : "bg-id-slate",
                    )}
                    style={{ width: percent(zone.share) }}
                  />
                </div>
                <span className="text-right font-mono text-xs">
                  {zone.count}
                </span>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="flex flex-col gap-3.5 px-5 py-[18px]">
          <PanelTitle title="Open item age" detail="Since discovery" />
          <div className="flex h-[150px] items-end gap-2.5" aria-hidden>
            {model.aging.map((bucket) => (
              <div
                key={bucket.id}
                className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5"
              >
                <span className="text-lead font-semibold">{bucket.count}</span>
                <div className="flex min-h-0 flex-1 items-end">
                  <div
                    className={cn("w-full", AGE_BAR[bucket.id])}
                    style={{ height: percent(bucket.share) }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-[-6px] flex gap-2.5" aria-hidden>
            {model.aging.map((bucket) => (
              <div
                key={bucket.id}
                className="flex-1 font-mono text-eyebrow text-ink-muted uppercase"
              >
                {bucket.label}
              </div>
            ))}
          </div>
          <p className="border-t border-line-faint pt-2.5 text-[12.5px] text-ink-3">
            {model.agingNote}
          </p>
          <table className="sr-only">
            <caption>Open item age since discovery</caption>
            <thead>
              <tr>
                <th scope="col">Age</th>
                <th scope="col">Items</th>
              </tr>
            </thead>
            <tbody>
              {model.aging.map((bucket) => (
                <tr key={bucket.id}>
                  <th scope="row">{bucket.label}</th>
                  <td>{bucket.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="flex flex-col gap-3.5 px-5 py-[18px]">
          <PanelTitle title="Engineer load" detail="Active items" />
          <ol className="flex flex-col gap-[11px]">
            {model.engineers.map((person) => (
              <li
                key={person.initials}
                className="grid grid-cols-[26px_minmax(80px,104px)_minmax(0,1fr)_22px] items-center gap-2.5"
              >
                <span
                  className={cn(
                    "flex size-[26px] items-center justify-center rounded-full text-[10.5px] font-semibold text-white",
                    person.colorClass,
                  )}
                  aria-hidden
                >
                  {person.initials}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="text-body">{person.name}</span>
                  <span className="text-caption text-ink-muted">
                    {person.role}
                  </span>
                </span>
                <span className="flex h-2.5 bg-paper" aria-hidden>
                  <span
                    className="h-full bg-navy"
                    style={{ width: percent(person.analystShare) }}
                  />
                  <span
                    className="h-full bg-warn"
                    style={{ width: percent(person.checkerShare) }}
                  />
                </span>
                <span
                  className={cn(
                    "text-right font-mono text-xs",
                    person.totalTone === "bad" ? "text-accent" : "text-ink",
                  )}
                >
                  <span className="sr-only">
                    {person.name}, {person.total} active items.{" "}
                  </span>
                  {person.total}
                </span>
              </li>
            ))}
          </ol>
          <ul className="flex gap-3.5 text-xs text-ink-3">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 bg-navy" aria-hidden />
              Analyst
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 bg-warn" aria-hidden />
              Checker
            </li>
          </ul>
        </Card>
      </div>

      <Card className="flex flex-col">
        <div className="flex flex-wrap items-baseline gap-3 border-b border-line px-5 py-4">
          <h2 className="text-card-title font-semibold">Needs attention</h2>
          <p className="text-[12.5px] whitespace-nowrap text-ink-muted">
            Overdue, negative margin, or asset down
          </p>
          <Link
            href="/engineering"
            className="ml-auto text-[12.5px] whitespace-nowrap text-navy no-underline hover:text-accent"
          >
            All analyses
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left text-body">
            <thead>
              <tr className="border-b border-line-faint bg-paper-raised font-mono text-eyebrow tracking-th text-ink-muted uppercase">
                <th scope="col" className="px-5 py-2 font-medium">
                  ID
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Item
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Identifier
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Stage
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Owner
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  MS
                </th>
                <th scope="col" className="px-5 py-2 font-medium">
                  Flag
                </th>
              </tr>
            </thead>
            <tbody>
              {model.attention.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-line-faint hover:bg-paper-raised"
                >
                  <th scope="row" className="px-5 py-[11px] font-normal">
                    <Link
                      href={`/engineering#${row.id}`}
                      className="font-mono text-xs text-ink no-underline hover:text-accent"
                    >
                      {row.id}
                    </Link>
                  </th>
                  <td className="max-w-[280px] truncate px-3 py-[11px]">
                    <Link
                      href={`/engineering#${row.id}`}
                      className="text-ink no-underline hover:text-accent"
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-3 py-[11px] font-mono text-xs text-ink-3">
                    {row.identifier}
                  </td>
                  <td className="px-3 py-[11px] font-mono text-eyebrow tracking-pill uppercase">
                    {row.stageLabel}
                  </td>
                  <td className="px-3 py-[11px] text-ink-3">{row.owner}</td>
                  <td className="px-3 py-[11px] text-xs">
                    <MarginValue
                      margin={row.margin}
                      threshold={marginThreshold}
                    />
                  </td>
                  <td className="px-5 py-[11px]">
                    <StatusPill
                      label={row.flagLabel}
                      size="sm"
                      className={FLAG_CLASS[row.flag]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

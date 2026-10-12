import { Button } from "@/components/ui/button";
import { MarginValue } from "@/components/ui/margin-value";
import { LOW_MARGIN_THRESHOLD } from "@/config/analysis";
import { StatusPill } from "@/components/ui/status-pill";
import {
  lifecycleSteps,
  marginBarPercent,
  minMargin,
  peopleFor,
  STATUS_LABEL,
  STATUS_NOTE,
} from "@/features/analyses/derive";
import type {
  AnalysisRecord,
  LifecycleState,
  PersonTone,
} from "@/features/analyses/types";
import { marginColor } from "@/lib/margin";
import { cn } from "@/lib/utils";

import { STATUS_CLASS } from "./status";

const STEP_BAR: Record<LifecycleState, string> = {
  done: "bg-ink",
  current: "bg-accent",
  rework: "bg-accent",
  todo: "bg-line-soft",
  complete: "bg-ok",
};

const STEP_TEXT: Record<LifecycleState, string> = {
  done: "text-ink",
  current: "font-semibold text-accent",
  rework: "font-semibold text-accent",
  todo: "text-ink-faint",
  complete: "text-ok",
};

const PERSON_TONE: Record<PersonTone, string> = {
  navy: "border-navy text-navy",
  faint: "border-ink-faint text-ink-faint",
  ok: "border-ok text-ok",
  accent: "border-accent text-accent",
  warn: "border-warn text-warn",
};

export function AnalysisDetail({
  record,
  marginThreshold = LOW_MARGIN_THRESHOLD,
}: {
  record: AnalysisRecord;
  /** Organization cutoff. Defaults to `LOW_MARGIN_THRESHOLD`. */
  marginThreshold?: number;
}) {
  const steps = lifecycleSteps(record.status);
  const people = peopleFor(record);
  const margin = minMargin(record.cases);

  return (
    <aside
      aria-label="Selected analysis"
      className="flex w-full flex-col border-[1.5px] border-ink bg-surface lg:sticky lg:top-4 lg:w-[340px] lg:shrink-0"
    >
      <div className="flex flex-col gap-2 border-b border-line-soft px-[18px] py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs font-semibold">{record.id}</p>
          <StatusPill
            label={STATUS_LABEL[record.status]}
            size="xs"
            className={STATUS_CLASS[record.status]}
          />
        </div>
        <h2 className="text-title font-semibold text-pretty">{record.title}</h2>
        <p className="font-mono text-caption text-ink-muted">
          Identifier {record.identifier} · {record.zone} · {record.method}
        </p>
      </div>

      <section className="flex flex-col gap-2.5 border-b border-line-soft px-[18px] py-3.5">
        <h3 className="font-mono text-2xs font-semibold tracking-eyebrow text-ink-faint uppercase">
          Lifecycle
        </h3>
        <ol className="grid grid-cols-4 gap-[3px]">
          {steps.map((step) => (
            <li key={step.label} className="flex flex-col gap-1">
              <span className={cn("h-[5px]", STEP_BAR[step.state])} />
              <span
                className={cn(
                  "font-mono text-2xs tracking-label uppercase",
                  STEP_TEXT[step.state],
                )}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-[12.5px] leading-snug text-ink-3">
          {STATUS_NOTE[record.status]}
        </p>
      </section>

      <section className="flex flex-col gap-2.5 border-b border-line-soft px-[18px] py-3.5">
        <h3 className="font-mono text-2xs font-semibold tracking-eyebrow text-ink-faint uppercase">
          People
        </h3>
        <ul className="flex flex-col gap-2.5">
          {people.map((person) => (
            <li key={person.role} className="flex items-center gap-2.5">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold text-white"
                style={{ backgroundColor: person.color }}
                aria-hidden
              >
                {person.initials}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body font-medium">{person.name}</span>
                <span className="text-sub text-ink-muted">{person.role}</span>
              </span>
              <span
                className={cn(
                  "border px-1.5 py-0.5 font-mono text-2xs tracking-label uppercase",
                  PERSON_TONE[person.tone],
                )}
              >
                {person.state}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2.5 border-b border-line-soft px-[18px] py-3.5">
        <h3 className="font-mono text-2xs font-semibold tracking-eyebrow text-ink-faint uppercase">
          Attached repair
        </h3>
        <div className="flex flex-col gap-1.5 border border-line bg-paper-raised p-3">
          <div className="flex justify-between gap-2">
            <span className="font-mono text-sub font-semibold text-navy">
              {record.repair.id} · Rev {record.repair.revision}
            </span>
            <span className="font-mono text-eyebrow text-ink-muted">
              {record.repair.type}
            </span>
          </div>
          <p className="text-body font-medium">{record.repair.title}</p>
          <p className="text-xs text-ink-muted">{record.repair.detail}</p>
        </div>
        <div className="flex justify-between gap-2 text-xs text-ink-muted">
          <span>
            From issue{" "}
            <span className="font-mono text-sub">{record.issue.id}</span>
          </span>
          <span>{record.issue.found}</span>
        </div>
      </section>

      <section className="flex flex-col gap-2.5 border-b border-line-soft px-[18px] py-3.5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-2xs font-semibold tracking-eyebrow text-ink-faint uppercase">
            Margins
          </h3>
          <p className="font-mono text-eyebrow text-ink-muted">
            {record.cases.length === 0
              ? "No cases run yet"
              : `${record.cases.length} governing checks`}
          </p>
        </div>
        {record.cases.length === 0 ? (
          <p className="text-[12.5px] text-ink-2">
            Awaiting first run{" "}
            <MarginValue
              margin={margin}
              threshold={marginThreshold}
              className="font-semibold"
            />
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {record.cases.map((entry) => (
              <li
                key={entry.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1"
              >
                <span className="text-[12.5px] text-ink-2">{entry.name}</span>
                <MarginValue
                  margin={entry.margin}
                  threshold={marginThreshold}
                  className="text-[12.5px] font-semibold"
                />
                <span className="col-span-2 h-[3px] bg-line-faint" aria-hidden>
                  <span
                    className="block h-[3px]"
                    style={{
                      width: `${marginBarPercent(entry.margin)}%`,
                      backgroundColor: marginColor(
                        entry.margin,
                        marginThreshold,
                      ),
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 px-[18px] py-3.5">
        <h3 className="font-mono text-2xs font-semibold tracking-eyebrow text-ink-faint uppercase">
          Latest
        </h3>
        <ol className="flex flex-col gap-2">
          {record.log.map((entry) => (
            <li
              key={`${entry.time}-${entry.text}`}
              className="grid grid-cols-[64px_minmax(0,1fr)] gap-2 text-xs leading-snug"
            >
              <span className="font-mono text-eyebrow text-ink-faint">
                {entry.time}
              </span>
              <span className="text-ink-3">{entry.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex gap-2 border-t border-line-soft bg-paper-raised px-[18px] py-3.5">
        <Button
          variant="dark"
          className="flex-1"
          href={`/analyses/${encodeURIComponent(record.id)}`}
        >
          Open analysis
        </Button>
        <Button variant="outline" className="flex-1">
          Layer Loads
        </Button>
      </div>
    </aside>
  );
}

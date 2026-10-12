import type {
  DbWorkStage,
  SnapshotAnalysis,
  SnapshotIssue,
  TenantSnapshot,
} from "@/db/snapshot";
import { daysBetween, formatAsOfLabel, shiftIsoDate } from "@/lib/dates";
import { classifyMargin } from "@/lib/margin";

import {
  agingNote,
  buildPipeline,
  countByAge,
  countByZone,
  engineerRows,
  itemsNeedingAttention,
} from "./derive";
import {
  inDayWindow,
  periodStart,
  PERIOD_DAYS,
  throughputBuckets,
  THROUGHPUT_SUBTITLE,
} from "./periods";
import type {
  AttentionFlag,
  DashboardModel,
  DashboardPeriod,
  DeltaTone,
  Engineer,
  Kpi,
  OpenItem,
  StageMeta,
  ThroughputPoint,
  WorkStage,
} from "./types";

const UI_STAGE: Record<DbWorkStage, WorkStage | null> = {
  discovered: "issue",
  repair_defined: "repair",
  analysis: "analyze",
  review: "approve",
  approved: null,
  closed: null,
};

const STAGE_SHELL: readonly {
  id: WorkStage;
  step: string;
  label: string;
  db: DbWorkStage;
}[] = [
  { id: "issue", step: "01", label: "Issue", db: "discovered" },
  { id: "repair", step: "02", label: "Repair", db: "repair_defined" },
  { id: "analyze", step: "03", label: "Analyze", db: "analysis" },
  { id: "approve", step: "04", label: "Approve", db: "review" },
];

const ENGINEER_COLORS = [
  "bg-navy",
  "bg-id-brown",
  "bg-ok",
  "bg-id-rust",
  "bg-id-slate",
  "bg-id-plum",
] as const;

const FLAG_RANK: Record<AttentionFlag, number> = {
  "negative-margin": 0,
  "asset-down": 1,
  overdue: 2,
  "due-tomorrow": 3,
  "low-margin": 4,
};

type PlacedAnalysis = SnapshotAnalysis & {
  repairTitle: string;
};

function dayOf(instant: string): string {
  return instant.slice(0, 10);
}

function analysesOn(issue: SnapshotIssue): PlacedAnalysis[] {
  const placed: PlacedAnalysis[] = [];

  for (const repair of issue.repairs) {
    for (const revision of repair.revisions) {
      for (const analysis of revision.analyses) {
        placed.push({
          ...analysis,
          repairTitle: repair.title,
        });
      }
    }
  }

  return placed.sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

function latestAnalysis(issue: SnapshotIssue): PlacedAnalysis | null {
  const placed = analysesOn(issue);
  return placed[placed.length - 1] ?? null;
}

/** Calendar day the issue was discovered, from the first stage transition. */
export function discoveredOn(issue: SnapshotIssue): string {
  const days = issue.transitions
    .map((transition) => dayOf(transition.at))
    .sort();
  return days[0] ?? issue.discoveredAt;
}

function closedOn(issue: SnapshotIssue): string | null {
  const days = issue.transitions
    .filter(
      (transition) =>
        transition.toStage === "approved" || transition.toStage === "closed",
    )
    .map((transition) => dayOf(transition.at))
    .sort();

  if (days[0]) {
    return days[0];
  }

  if (issue.stage === "approved" || issue.stage === "closed") {
    return issue.discoveredAt;
  }

  return null;
}

function isOpen(issue: SnapshotIssue): boolean {
  return UI_STAGE[issue.stage] !== null;
}

function wasOpenAt(issue: SnapshotIssue, cutoff: string): boolean {
  if (discoveredOn(issue) > cutoff) {
    return false;
  }

  const closed = closedOn(issue);
  return closed == null || closed > cutoff;
}

function minMargin(analysis: SnapshotAnalysis | null): number | null {
  if (!analysis || analysis.cases.length === 0) {
    return null;
  }

  return Math.min(...analysis.cases.map((entry) => entry.margin));
}

function mentionsSupplier(issue: SnapshotIssue): boolean {
  return issue.activity.some((entry) =>
    entry.message.toLowerCase().includes("supplier"),
  );
}

function ownerName(
  issue: SnapshotIssue,
  analysis: PlacedAnalysis | null,
): string | null {
  const analyst = analysis?.people.find((person) => person.role === "analyst");
  return analyst?.name ?? analysis?.owner?.name ?? issue.reporterName;
}

function openItem(
  issue: SnapshotIssue,
  asOf: string,
  threshold: number,
): OpenItem | null {
  const stage = UI_STAGE[issue.stage];
  if (!stage) {
    return null;
  }

  const analysis = latestAnalysis(issue);
  const margin = minMargin(analysis);
  const dueOn = analysis?.dueDate ?? null;
  const overdueDays =
    dueOn && analysis?.status !== "approved" && dueOn < asOf
      ? daysBetween(dueOn, asOf)
      : null;
  const marginClass = classifyMargin(margin, threshold);
  let flag: AttentionFlag | null = null;

  if (marginClass === "negative") {
    flag = "negative-margin";
  } else if (issue.assetOutOfService) {
    flag = "asset-down";
  } else if (overdueDays != null && overdueDays > 0) {
    flag = "overdue";
  } else if (
    dueOn === shiftIsoDate(asOf, 1) &&
    analysis != null &&
    analysis.status !== "approved"
  ) {
    flag = "due-tomorrow";
  } else if (marginClass === "low") {
    flag = "low-margin";
  }

  const repair = [...issue.repairs].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )[0];

  return {
    id: analysis?.code ?? issue.code,
    title: analysis?.title ?? repair?.title ?? issue.description,
    identifier: issue.assetIdentifier,
    stage,
    zone: issue.zone ?? "Unspecified",
    discoveredOn: discoveredOn(issue),
    owner: ownerName(issue, analysis),
    margin,
    flag,
    attentionOrder: flag == null ? null : FLAG_RANK[flag],
    rework: analysesOn(issue).some(
      (entry) => entry.status === "changes_requested",
    ),
    waitingOnSupplier: mentionsSupplier(issue),
    ...(overdueDays != null && overdueDays > 0 ? { overdueDays } : {}),
  };
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) {
    return upper;
  }

  const lower = sorted[mid - 1] ?? upper;
  return (lower + upper) / 2;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Days spent in each database stage, summed across visits. */
function stageDays(
  issue: SnapshotIssue,
  asOf: string,
): Map<DbWorkStage, number> {
  const totals = new Map<DbWorkStage, number>();
  const sorted = [...issue.transitions].sort((left, right) =>
    left.at.localeCompare(right.at),
  );
  const asOfMs = Date.parse(`${asOf}T00:00:00.000Z`);

  if (sorted.length === 0) {
    const start = Date.parse(`${issue.discoveredAt}T00:00:00.000Z`);
    if (Number.isFinite(start) && asOfMs >= start) {
      totals.set(issue.stage, (asOfMs - start) / 86_400_000);
    }
    return totals;
  }

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (!current) {
      continue;
    }

    const next = sorted[index + 1];
    const start = Date.parse(current.at);
    const end = next ? Date.parse(next.at) : asOfMs;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      continue;
    }

    totals.set(
      current.toStage,
      (totals.get(current.toStage) ?? 0) + (end - start) / 86_400_000,
    );
  }

  return totals;
}

function enteredCurrent(issue: SnapshotIssue, asOf: string): string {
  const matches = issue.transitions
    .filter((transition) => transition.toStage === issue.stage)
    .map((transition) => dayOf(transition.at))
    .sort();

  return matches[matches.length - 1] ?? discoveredOn(issue) ?? asOf;
}

function pipeline(snapshot: TenantSnapshot, asOf: string): StageMeta[] {
  const open = snapshot.issues.filter(isOpen);
  const counts = new Map<WorkStage, number>(
    STAGE_SHELL.map((stage) => [stage.id, 0]),
  );

  for (const issue of open) {
    const stage = UI_STAGE[issue.stage];
    if (stage) {
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
  }

  const untriaged = open.filter(
    (issue) => issue.stage === "discovered" && issue.repairs.length === 0,
  ).length;
  const withoutRevision = open.filter(
    (issue) =>
      issue.stage === "repair_defined" &&
      issue.repairs.every((repair) => repair.revisions.length === 0),
  ).length;
  const rework = open.filter((issue) =>
    analysesOn(issue).some(
      (analysis) => analysis.status === "changes_requested",
    ),
  ).length;
  const approver = [...snapshot.users]
    .filter((user) => user.role === "approver")
    .sort((left, right) => left.name.localeCompare(right.name))[0];

  return STAGE_SHELL.map((stage) => {
    const samples = snapshot.issues
      .map((issue) => stageDays(issue, asOf).get(stage.db))
      .filter((days): days is number => days != null && days > 0);
    const medianDays = round1(median(samples));
    const count = counts.get(stage.id) ?? 0;

    if (stage.id === "issue") {
      return {
        id: stage.id,
        step: stage.step,
        label: stage.label,
        medianDays,
        note: `${untriaged} untriaged`,
        noteTone: untriaged > 0 ? "bad" : "neutral",
      };
    }

    if (stage.id === "repair") {
      return {
        id: stage.id,
        step: stage.step,
        label: stage.label,
        medianDays,
        note: `${withoutRevision} without a revision`,
        noteTone: "neutral",
      };
    }

    if (stage.id === "analyze") {
      return {
        id: stage.id,
        step: stage.step,
        label: stage.label,
        medianDays,
        note: `${rework} in rework`,
        noteTone: rework > 0 ? "bad" : "neutral",
      };
    }

    const queued = `${count} queued`;
    return {
      id: stage.id,
      step: stage.step,
      label: stage.label,
      medianDays,
      note: approver ? `${approver.name} · ${queued}` : queued,
      noteTone: "neutral" as const,
    };
  });
}

function signed(
  delta: number,
  suffix: string,
  positiveTone: DeltaTone,
): { delta: string; deltaTone: DeltaTone } {
  if (delta === 0) {
    return { delta: `0 ${suffix}`, deltaTone: "neutral" };
  }

  const tone =
    delta > 0 ? positiveTone : positiveTone === "bad" ? "good" : "bad";
  const body = `${Math.abs(delta)} ${suffix}`;
  return {
    delta: delta > 0 ? `+${body}` : `\u2212${body}`,
    deltaTone: tone,
  };
}

function dayDelta(
  current: number | null,
  prior: number | null,
): { delta: string; deltaTone: DeltaTone } {
  if (current == null || prior == null) {
    return { delta: "\u2014", deltaTone: "neutral" };
  }

  const rounded = round1(current - prior);
  if (rounded === 0) {
    return { delta: "0 d", deltaTone: "neutral" };
  }

  const tone: DeltaTone = rounded < 0 ? "good" : "bad";
  const body = `${Math.abs(rounded).toFixed(1)} d`;
  return {
    delta: rounded < 0 ? `\u2212${body}` : `+${body}`,
    deltaTone: tone,
  };
}

function percentDelta(
  current: number,
  prior: number,
): {
  delta: string;
  deltaTone: DeltaTone;
} {
  if (prior === 0) {
    if (current === 0) {
      return { delta: "0% YoY", deltaTone: "neutral" };
    }
    return { delta: "+100% YoY", deltaTone: "good" };
  }

  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) {
    return { delta: "0% YoY", deltaTone: "neutral" };
  }

  return {
    delta: pct > 0 ? `+${pct}% YoY` : `\u2212${Math.abs(pct)}% YoY`,
    deltaTone: pct > 0 ? "good" : "bad",
  };
}

function cycleTimes(
  snapshot: TenantSnapshot,
  startExclusive: string,
  endInclusive: string,
): number[] {
  const samples: number[] = [];

  for (const issue of snapshot.issues) {
    const approved = issue.transitions
      .filter((transition) => transition.toStage === "approved")
      .map((transition) => dayOf(transition.at))
      .sort();
    const approvedOn = approved[0];
    if (
      !approvedOn ||
      approvedOn <= startExclusive ||
      approvedOn > endInclusive
    ) {
      continue;
    }

    samples.push(daysBetween(discoveredOn(issue), approvedOn));
  }

  return samples;
}

function closedCount(
  snapshot: TenantSnapshot,
  startExclusive: string,
  endInclusive: string,
): number {
  const issues = new Set<string>();

  for (const issue of snapshot.issues) {
    const hit = issue.transitions.some(
      (transition) =>
        (transition.toStage === "approved" ||
          transition.toStage === "closed") &&
        inDayWindow(transition.at, startExclusive, endInclusive),
    );
    if (hit) {
      issues.add(issue.id);
    }
  }

  return issues.size;
}

function firstPass(
  snapshot: TenantSnapshot,
  startExclusive: string,
  endInclusive: string,
): number | null {
  const approved = snapshot.issues.flatMap((issue) =>
    analysesOn(issue).filter(
      (analysis) =>
        analysis.status === "approved" &&
        inDayWindow(analysis.updatedAt, startExclusive, endInclusive),
    ),
  );

  if (approved.length === 0) {
    return null;
  }

  const clean = approved.filter(
    (analysis) =>
      !analysis.reviews.some(
        (review) => review.decision === "changes_requested",
      ),
  );

  return (clean.length / approved.length) * 100;
}

function overdueAnalyses(
  snapshot: TenantSnapshot,
  asOf: string,
): SnapshotAnalysis[] {
  return snapshot.issues.flatMap((issue) =>
    analysesOn(issue).filter(
      (analysis) =>
        analysis.dueDate != null &&
        analysis.dueDate < asOf &&
        analysis.status !== "approved",
    ),
  );
}

function pointsDelta(
  current: number | null,
  prior: number | null,
): { delta: string; deltaTone: DeltaTone } {
  if (current == null || prior == null) {
    return { delta: "\u2014", deltaTone: "neutral" };
  }

  const diff = Math.round(current - prior);
  if (diff === 0) {
    return { delta: "0 pts", deltaTone: "neutral" };
  }

  return {
    delta: diff > 0 ? `+${diff} pts` : `\u2212${Math.abs(diff)} pts`,
    deltaTone: diff > 0 ? "good" : "bad",
  };
}

function kpis(
  snapshot: TenantSnapshot,
  period: DashboardPeriod,
  asOf: string,
  open: OpenItem[],
): Kpi[] {
  const start = periodStart(asOf, period);
  const priorStart = shiftIsoDate(start, -PERIOD_DAYS[period]);
  const openNow = open.length;
  const openThen = snapshot.issues.filter((issue) =>
    wasOpenAt(issue, start),
  ).length;
  const openDelta = signed(openNow - openThen, "vs prior", "bad");
  const currentCycle = cycleTimes(snapshot, start, asOf);
  const priorCycle = cycleTimes(snapshot, priorStart, start);
  const currentMedian = currentCycle.length === 0 ? null : median(currentCycle);
  const priorMedian = priorCycle.length === 0 ? null : median(priorCycle);
  const cycle = dayDelta(currentMedian, priorMedian);
  const awaiting = open.filter((item) => item.stage === "approve");
  const waits = snapshot.issues
    .filter((issue) => issue.stage === "review")
    .map((issue) => daysBetween(enteredCurrent(issue, asOf), asOf));
  const slow = waits.filter((days) => days > 3).length;
  const averageWait =
    waits.length === 0
      ? 0
      : waits.reduce((sum, days) => sum + days, 0) / waits.length;
  const approvalNote =
    period === "30D"
      ? `${slow} > 3 days`
      : `avg ${averageWait.toFixed(1)} d wait`;
  const currentPass = firstPass(snapshot, start, asOf);
  const priorPass = firstPass(snapshot, priorStart, start);
  const passDelta = pointsDelta(currentPass, priorPass);
  const overdueNow = overdueAnalyses(snapshot, asOf).length;
  const overdueThen = snapshot.issues.flatMap((issue) =>
    analysesOn(issue).filter((analysis) => {
      if (analysis.dueDate == null || analysis.dueDate >= start) {
        return false;
      }
      if (analysis.status !== "approved") {
        return true;
      }
      return dayOf(analysis.updatedAt) > start;
    }),
  ).length;
  const overdueDelta = signed(overdueNow - overdueThen, "vs prior", "bad");
  const down = snapshot.assets.filter((asset) => asset.outOfService);
  const downNote =
    period === "30D"
      ? down
          .map((asset) => asset.identifier)
          .sort()
          .join(", ") || "none down"
      : `${down.length} currently down`;
  const closedNow = closedCount(snapshot, start, asOf);
  const closedThen = closedCount(snapshot, priorStart, start);
  const closed = percentDelta(closedNow, closedThen);

  const openKpi: Kpi =
    period === "12M"
      ? {
          label: "Items closed",
          value: String(closedNow),
          unit: "",
          delta: closed.delta,
          deltaTone: closed.deltaTone,
        }
      : {
          label: "Open items",
          value: String(openNow),
          unit: "",
          delta: openDelta.delta,
          deltaTone: openDelta.deltaTone,
        };

  return [
    openKpi,
    {
      label: "Median cycle time",
      value: currentMedian == null ? "\u2014" : currentMedian.toFixed(1),
      unit: "days",
      delta: cycle.delta,
      deltaTone: cycle.deltaTone,
    },
    {
      label: "Awaiting approval",
      value: String(awaiting.length),
      unit: "",
      delta: approvalNote,
      deltaTone: "neutral",
    },
    {
      label: "First-pass check",
      value: currentPass == null ? "\u2014" : String(Math.round(currentPass)),
      unit: "%",
      delta: passDelta.delta,
      deltaTone: passDelta.deltaTone,
    },
    {
      label: "Overdue",
      value: String(overdueNow),
      unit: "",
      delta: overdueDelta.delta,
      deltaTone: overdueDelta.deltaTone,
    },
    {
      label: "Assets down",
      value: String(down.length),
      unit: `of ${snapshot.assets.length}`,
      delta: downNote,
      deltaTone: "neutral",
    },
  ];
}

function throughput(
  snapshot: TenantSnapshot,
  period: DashboardPeriod,
  asOf: string,
): ThroughputPoint[] {
  return throughputBuckets(period, asOf).map((bucket) => {
    let opened = 0;
    let approved = 0;

    for (const issue of snapshot.issues) {
      for (const transition of issue.transitions) {
        if (transition.at < bucket.start || transition.at >= bucket.end) {
          continue;
        }
        if (transition.toStage === "discovered") {
          opened += 1;
        }
        if (transition.toStage === "approved") {
          approved += 1;
        }
      }
    }

    return { label: bucket.label, opened, approved };
  });
}

function engineers(snapshot: TenantSnapshot): Engineer[] {
  const openAnalyses = snapshot.issues.flatMap((issue) =>
    analysesOn(issue).filter((analysis) => analysis.status !== "approved"),
  );
  const inReview = openAnalyses.filter(
    (analysis) => analysis.status === "in_review",
  );
  const staff = snapshot.users
    .filter(
      (user) =>
        user.role === "analyst" ||
        user.role === "checker" ||
        user.role === "approver",
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  const rows: Engineer[] = [];

  for (const user of staff) {
    const colorClass =
      ENGINEER_COLORS[rows.length % ENGINEER_COLORS.length] ?? "bg-navy";

    if (user.role === "approver") {
      const queue = inReview.filter((analysis) =>
        analysis.people.some(
          (person) => person.userId === user.id && person.role === "approver",
        ),
      ).length;
      if (queue === 0) {
        continue;
      }
      rows.push({
        initials: user.initials,
        name: user.name,
        role: "Engineering authority",
        colorClass,
        analyst: 0,
        checker: 0,
        displayCount: queue,
        fullBar: true,
      });
      continue;
    }

    const analyst = openAnalyses.filter((analysis) =>
      analysis.people.some(
        (person) => person.userId === user.id && person.role === "analyst",
      ),
    ).length;
    const checker = openAnalyses.filter((analysis) =>
      analysis.people.some(
        (person) => person.userId === user.id && person.role === "checker",
      ),
    ).length;

    if (analyst + checker === 0) {
      continue;
    }

    rows.push({
      initials: user.initials,
      name: user.name,
      role: user.role === "checker" ? "Checker" : "Analyst",
      colorClass,
      analyst,
      checker,
    });
  }

  return rows;
}

function attentionItems(items: readonly OpenItem[]): OpenItem[] {
  return [...items]
    .sort((left, right) => {
      const leftRank =
        left.flag == null ? FLAG_RANK["low-margin"] + 1 : FLAG_RANK[left.flag];
      const rightRank =
        right.flag == null
          ? FLAG_RANK["low-margin"] + 1
          : FLAG_RANK[right.flag];
      return leftRank - rightRank || left.id.localeCompare(right.id);
    })
    .map((item, index) =>
      item.flag == null ? item : { ...item, attentionOrder: index },
    );
}

/**
 * Dashboard view model for one tenant snapshot.
 * Pipeline counts use the issue's current stage. Age uses the first
 * stage transition. Throughput counts stage transitions in each bucket.
 */
export function buildDashboardModel(
  snapshot: TenantSnapshot,
  period: DashboardPeriod,
  asOf: string,
): DashboardModel {
  const items = attentionItems(
    snapshot.issues.flatMap((issue) => {
      const item = openItem(issue, asOf, snapshot.threshold);
      return item ? [item] : [];
    }),
  );

  return {
    period,
    asOf,
    asOfLabel: formatAsOfLabel(asOf),
    assetGroupName: snapshot.assetGroupName,
    kpis: kpis(snapshot, period, asOf, items),
    pipeline: buildPipeline(items, pipeline(snapshot, asOf)),
    throughputSubtitle: THROUGHPUT_SUBTITLE[period],
    throughput: throughput(snapshot, period, asOf),
    zones: countByZone(items),
    aging: countByAge(items, asOf),
    agingNote: agingNote(items, asOf),
    engineers: engineerRows(engineers(snapshot)),
    attention: itemsNeedingAttention(items),
  };
}

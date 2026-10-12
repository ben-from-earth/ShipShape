import { daysBetween } from "@/lib/dates";

import type {
  AgeBucket,
  AgeBucketId,
  AttentionFlag,
  AttentionRow,
  Engineer,
  EngineerRow,
  OpenItem,
  PipelineStage,
  StageMeta,
  WorkStage,
  ZoneCount,
} from "./types";

export const AGE_BUCKETS: readonly {
  id: AgeBucketId;
  label: string;
  maxDays: number;
}[] = [
  { id: "0-7", label: "0–7 D", maxDays: 7 },
  { id: "8-14", label: "8–14 D", maxDays: 14 },
  { id: "15-30", label: "15–30 D", maxDays: 30 },
  { id: "30+", label: "30+ D", maxDays: Number.POSITIVE_INFINITY },
];

const STAGE_LABEL: Record<WorkStage, string> = {
  issue: "Issue",
  repair: "Repair",
  analyze: "Analyze",
  approve: "Approve",
};

const FLAG_LABEL: Record<AttentionFlag, string> = {
  "negative-margin": "Negative MS",
  "asset-down": "Asset down",
  overdue: "Overdue",
  "due-tomorrow": "Due tomorrow",
  "low-margin": "Low margin",
};

/** Display scale for analyst and checker bars. Matches the mockup. */
const ENGINEER_BAR_SCALE = 8;

export function itemAgeDays(discoveredOn: string, asOf: string): number {
  return daysBetween(discoveredOn, asOf);
}

export function ageBucketId(days: number): AgeBucketId {
  if (days <= 7) {
    return "0-7";
  }
  if (days <= 14) {
    return "8-14";
  }
  if (days <= 30) {
    return "15-30";
  }
  return "30+";
}

export function countByStage(
  items: readonly OpenItem[],
): Record<WorkStage, number> {
  const counts: Record<WorkStage, number> = {
    issue: 0,
    repair: 0,
    analyze: 0,
    approve: 0,
  };

  for (const item of items) {
    counts[item.stage] += 1;
  }

  return counts;
}

export function buildPipeline(
  items: readonly OpenItem[],
  stages: readonly StageMeta[],
): PipelineStage[] {
  const counts = countByStage(items);
  const totalDays = stages.reduce((sum, stage) => sum + stage.medianDays, 0);

  return stages.map((stage) => ({
    ...stage,
    count: counts[stage.id],
    share: totalDays === 0 ? 0 : stage.medianDays / totalDays,
  }));
}

export function countByZone(items: readonly OpenItem[]): ZoneCount[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.zone, (counts.get(item.zone) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  );
  const max = ranked[0]?.[1] ?? 0;

  return ranked.map(([name, count], index) => ({
    name,
    count,
    share: max === 0 ? 0 : count / max,
    highlighted: index === 0 && count > 0,
  }));
}

export function countByAge(
  items: readonly OpenItem[],
  asOf: string,
): AgeBucket[] {
  const counts = new Map<AgeBucketId, number>(
    AGE_BUCKETS.map((bucket) => [bucket.id, 0]),
  );

  for (const item of items) {
    const bucket = ageBucketId(itemAgeDays(item.discoveredOn, asOf));
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  const max = Math.max(
    ...AGE_BUCKETS.map((bucket) => counts.get(bucket.id) ?? 0),
  );

  return AGE_BUCKETS.map((bucket) => {
    const count = counts.get(bucket.id) ?? 0;
    return {
      id: bucket.id,
      label: bucket.label,
      count,
      share: max === 0 ? 0 : count / max,
    };
  });
}

export function agingNote(items: readonly OpenItem[], asOf: string): string {
  const older = items.filter(
    (item) => itemAgeDays(item.discoveredOn, asOf) > 30,
  );
  const waiting = older.filter((item) => item.waitingOnSupplier).length;

  return `${older.length} items older than 30 days — ${waiting} are waiting on supplier repair data.`;
}

export function engineerRows(people: readonly Engineer[]): EngineerRow[] {
  return people.map((person) => {
    const load = person.analyst + person.checker;

    return {
      ...person,
      total: person.displayCount ?? load,
      totalTone: load >= 6 ? "bad" : "neutral",
      analystShare: person.fullBar ? 1 : person.analyst / ENGINEER_BAR_SCALE,
      checkerShare: person.fullBar ? 0 : person.checker / ENGINEER_BAR_SCALE,
    };
  });
}

export function stageLabel(item: OpenItem): string {
  if (item.rework) {
    return `${STAGE_LABEL[item.stage]} · Rework`;
  }

  return STAGE_LABEL[item.stage];
}

export function itemsNeedingAttention(
  items: readonly OpenItem[],
): AttentionRow[] {
  return items
    .filter(
      (item): item is OpenItem & { flag: AttentionFlag } => item.flag !== null,
    )
    .sort(
      (left, right) =>
        (left.attentionOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.attentionOrder ?? Number.MAX_SAFE_INTEGER),
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      identifier: item.identifier,
      stageLabel: stageLabel(item),
      owner: item.owner ?? "Unassigned",
      margin: item.margin,
      flag: item.flag,
      flagLabel:
        item.flag === "overdue" && item.title
          ? flagLabelFor(item)
          : FLAG_LABEL[item.flag],
    }));
}

function flagLabelFor(item: OpenItem & { flag: AttentionFlag }): string {
  if (item.flag === "overdue") {
    return `Overdue ${item.overdueDays ?? 4} d`;
  }

  return FLAG_LABEL[item.flag];
}

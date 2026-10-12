import { DEMO_AS_OF } from "@/config/demo";
import { shiftIsoDate } from "@/lib/dates";

import { ageBucketId } from "./derive";
import type {
  AttentionFlag,
  DashboardPeriod,
  Engineer,
  Kpi,
  OpenItem,
  StageMeta,
  ThroughputPoint,
  WorkStage,
} from "./types";

export const STAGE_META: readonly StageMeta[] = [
  {
    id: "issue",
    step: "01",
    label: "Issue",
    medianDays: 2.1,
    note: "3 untriaged",
    noteTone: "bad",
  },
  {
    id: "repair",
    step: "02",
    label: "Repair",
    medianDays: 5.6,
    note: "2 awaiting supplier data",
    noteTone: "neutral",
  },
  {
    id: "analyze",
    step: "03",
    label: "Analyze",
    medianDays: 7.9,
    note: "1 in rework",
    noteTone: "bad",
  },
  {
    id: "approve",
    step: "04",
    label: "Approve",
    medianDays: 2.8,
    note: "D. Lindqvist · 9 queued",
    noteTone: "neutral",
  },
];

const ZONE_QUOTAS: readonly (readonly [string, number])[] = [
  ["Aft fuselage", 11],
  ["Tail", 9],
  ["Wings", 8],
  ["Canopy, frames 5–13", 7],
  ["Forward fuselage", 5],
  ["Intakes", 4],
  ["Landing gear", 3],
];

const AGE_QUOTAS: readonly (readonly [number, number])[] = [
  [3, 18],
  [10, 13],
  [20, 11],
  [40, 5],
];

const STAGE_QUOTAS: readonly (readonly [WorkStage, number])[] = [
  ["issue", 14],
  ["repair", 12],
  ["analyze", 12],
  ["approve", 9],
];

type AttentionSeed = {
  id: string;
  title: string;
  identifier: string;
  stage: WorkStage;
  zone: string;
  ageDays: number;
  owner: string | null;
  margin: number | null;
  flag: AttentionFlag;
  attentionOrder: number;
  rework?: boolean;
  waitingOnSupplier?: boolean;
};

const ATTENTION: readonly AttentionSeed[] = [
  {
    id: "SA-26-109",
    title: "Horizontal stabilizer attach fitting rework",
    identifier: "165477",
    stage: "analyze",
    zone: "Tail",
    ageDays: 12,
    owner: "S. Okafor",
    margin: -0.06,
    flag: "negative-margin",
    attentionOrder: 0,
    rework: true,
  },
  {
    id: "IS-26-212",
    title: "Frame 9 cap crack, aft of the canopy",
    identifier: "165502",
    stage: "issue",
    zone: "Canopy, frames 5–13",
    ageDays: 6,
    owner: null,
    margin: null,
    flag: "asset-down",
    attentionOrder: 1,
  },
  {
    id: "RD-0462",
    title: "Stabilizer fitting bushing redesign",
    identifier: "165477",
    stage: "repair",
    zone: "Tail",
    ageDays: 40,
    owner: "A. Kowalski",
    margin: null,
    flag: "overdue",
    attentionOrder: 2,
    waitingOnSupplier: true,
  },
  {
    id: "SA-26-105",
    title: "Vertical fin rear spar cap blend",
    identifier: "165477",
    stage: "approve",
    zone: "Tail",
    ageDays: 2,
    owner: "D. Lindqvist",
    margin: 0.09,
    flag: "due-tomorrow",
    attentionOrder: 3,
  },
  {
    id: "SA-26-117",
    title: "Keel beam splice, corrosion blend-out",
    identifier: "165502",
    stage: "analyze",
    zone: "Aft fuselage",
    ageDays: 20,
    owner: "R. Tanaka",
    margin: 0.07,
    flag: "low-margin",
    attentionOrder: 4,
  },
];

function discoveredOn(ageDays: number): string {
  return shiftIsoDate(DEMO_AS_OF, -ageDays);
}

function toItem(seed: AttentionSeed): OpenItem {
  return {
    id: seed.id,
    title: seed.title,
    identifier: seed.identifier,
    stage: seed.stage,
    zone: seed.zone,
    discoveredOn: discoveredOn(seed.ageDays),
    owner: seed.owner,
    margin: seed.margin,
    flag: seed.flag,
    attentionOrder: seed.attentionOrder,
    rework: seed.rework ?? false,
    waitingOnSupplier: seed.waitingOnSupplier ?? false,
  };
}

type Quota = { name: string; remaining: number };

function take(quotas: Quota[]): Quota {
  const next = quotas.find((quota) => quota.remaining > 0);
  if (!next) {
    throw new Error("Demo quota exhausted while building open items");
  }
  next.remaining -= 1;
  return next;
}

function consume(quotas: Quota[], name: string) {
  const quota = quotas.find((item) => item.name === name);
  if (!quota || quota.remaining < 1) {
    throw new Error(`Demo attention item exceeds the ${name} quota`);
  }
  quota.remaining -= 1;
}

export function buildOpenItems(): OpenItem[] {
  const stages: Quota[] = STAGE_QUOTAS.map(([name, remaining]) => ({
    name,
    remaining,
  }));
  const zones: Quota[] = ZONE_QUOTAS.map(([name, remaining]) => ({
    name,
    remaining,
  }));
  const ages: Quota[] = AGE_QUOTAS.map(([days, remaining]) => ({
    name: String(days),
    remaining,
  }));
  const attention = ATTENTION.map(toItem);

  for (const seed of ATTENTION) {
    consume(stages, seed.stage);
    consume(zones, seed.zone);
    consume(
      ages,
      String(
        seed.ageDays <= 7
          ? 3
          : seed.ageDays <= 14
            ? 10
            : seed.ageDays <= 30
              ? 20
              : 40,
      ),
    );
  }

  const fillers: OpenItem[] = [];
  let sequence = 1;
  let supplierWaits = attention.filter((item) => item.waitingOnSupplier).length;

  while (stages.some((stage) => stage.remaining > 0)) {
    const stage = take(stages);
    const zone = take(zones);
    const age = take(ages);
    const ageDays = Number(age.name);
    const waiting = ageBucketId(ageDays) === "30+" && supplierWaits < 3;
    if (waiting) {
      supplierWaits += 1;
    }

    fillers.push({
      id: `OP-${sequence}`,
      title: `Open item ${sequence}`,
      identifier: "",
      stage: stage.name as WorkStage,
      zone: zone.name,
      discoveredOn: discoveredOn(ageDays),
      owner: null,
      margin: null,
      flag: null,
      attentionOrder: null,
      rework: false,
      waitingOnSupplier: waiting,
    });
    sequence += 1;
  }

  return [...attention, ...fillers];
}

export const OPEN_ITEMS: readonly OpenItem[] = buildOpenItems();

const kpi = (
  label: string,
  value: string,
  unit: string,
  delta: string,
  deltaTone: Kpi["deltaTone"],
): Kpi => ({ label, value, unit, delta, deltaTone });

export const PERIOD_KPIS: Record<DashboardPeriod, readonly Kpi[]> = {
  "30D": [
    kpi("Open items", "47", "", "+6 vs prior", "bad"),
    kpi("Median cycle time", "18.4", "days", "\u22122.1 d", "good"),
    kpi("Awaiting approval", "9", "", "2 > 3 days", "neutral"),
    kpi("First-pass check", "86", "%", "+4 pts", "good"),
    kpi("Overdue", "5", "", "+1 vs prior", "bad"),
    kpi("Assets down", "3", "of 24", "165477, 165480, 165502", "neutral"),
  ],
  "90D": [
    kpi("Open items", "47", "", "+11 vs prior", "bad"),
    kpi("Median cycle time", "19.7", "days", "\u22120.8 d", "good"),
    kpi("Awaiting approval", "9", "", "avg 2.4 d wait", "neutral"),
    kpi("First-pass check", "83", "%", "+1 pt", "good"),
    kpi("Overdue", "5", "", "\u22122 vs prior", "good"),
    kpi("Assets down", "3", "of 24", "avg 2.6 over period", "neutral"),
  ],
  "12M": [
    kpi("Items closed", "293", "", "+18% YoY", "good"),
    kpi("Median cycle time", "21.2", "days", "\u22124.5 d YoY", "good"),
    kpi("Awaiting approval", "9", "", "avg 2.9 d wait", "neutral"),
    kpi("First-pass check", "81", "%", "+6 pts YoY", "good"),
    kpi("Overdue", "5", "", "peak 11 in Mar", "neutral"),
    kpi("Assets down", "3", "of 24", "avg 3.1 over year", "neutral"),
  ],
};

const point = (
  label: string,
  opened: number,
  approved: number,
): ThroughputPoint => ({ label, opened, approved });

export const PERIOD_THROUGHPUT: Record<
  DashboardPeriod,
  { subtitle: string; points: readonly ThroughputPoint[] }
> = {
  "30D": {
    subtitle: "Weekly, last 12 weeks",
    points: [
      point("W30", 5, 4),
      point("W31", 7, 5),
      point("W32", 4, 6),
      point("W33", 6, 5),
      point("W34", 9, 6),
      point("W35", 5, 7),
      point("W36", 8, 5),
      point("W37", 6, 8),
      point("W38", 7, 6),
      point("W39", 10, 7),
      point("W40", 6, 8),
      point("W41", 8, 6),
    ],
  },
  "90D": {
    subtitle: "Bi-weekly, last 24 weeks",
    points: [
      point("Apr", 11, 10),
      point("", 13, 11),
      point("May", 9, 12),
      point("", 14, 10),
      point("Jun", 12, 13),
      point("", 15, 12),
      point("Jul", 13, 14),
      point("", 11, 12),
      point("Aug", 16, 13),
      point("", 12, 14),
      point("Sep", 14, 13),
      point("", 15, 15),
    ],
  },
  "12M": {
    subtitle: "Monthly, last 12 months",
    points: [
      point("N", 22, 20),
      point("D", 18, 21),
      point("J", 25, 22),
      point("F", 27, 24),
      point("M", 24, 26),
      point("A", 30, 25),
      point("M", 28, 29),
      point("J", 26, 27),
      point("J", 31, 28),
      point("A", 29, 30),
      point("S", 33, 31),
      point("O", 12, 10),
    ],
  },
};

export const ENGINEERS: readonly Engineer[] = [
  {
    initials: "JM",
    name: "J. Morales",
    role: "Analyst",
    colorClass: "bg-navy",
    analyst: 4,
    checker: 2,
  },
  {
    initials: "AK",
    name: "A. Kowalski",
    role: "Analyst",
    colorClass: "bg-id-brown",
    analyst: 2,
    checker: 4,
  },
  {
    initials: "RT",
    name: "R. Tanaka",
    role: "Analyst",
    colorClass: "bg-ok",
    analyst: 3,
    checker: 1,
  },
  {
    initials: "SO",
    name: "S. Okafor",
    role: "Analyst",
    colorClass: "bg-id-rust",
    analyst: 3,
    checker: 1,
  },
  {
    initials: "MB",
    name: "M. Brennan",
    role: "Analyst",
    colorClass: "bg-id-slate",
    analyst: 2,
    checker: 2,
  },
  {
    initials: "DL",
    name: "D. Lindqvist",
    role: "Engineering authority",
    colorClass: "bg-id-plum",
    analyst: 0,
    checker: 0,
    displayCount: 9,
    fullBar: true,
  },
];

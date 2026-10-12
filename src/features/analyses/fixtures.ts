import type { AnalysisRecord, Person, PersonId } from "./types";

const FIXTURE_PEOPLE: Record<PersonId, Person> = {
  JM: { id: "JM", name: "J. Morales", color: "#1e2d55" },
  AK: { id: "AK", name: "A. Kowalski", color: "#6b4f2a" },
  RT: { id: "RT", name: "R. Tanaka", color: "#2f5d50" },
  DL: { id: "DL", name: "D. Lindqvist", color: "#5a3d6b" },
  SO: { id: "SO", name: "S. Okafor", color: "#8a3a2a" },
  MB: { id: "MB", name: "M. Brennan", color: "#3d4a5c" },
};

const PERSON_COLORS = [
  "#1e2d55",
  "#6b4f2a",
  "#2f5d50",
  "#5a3d6b",
  "#8a3a2a",
  "#3d4a5c",
] as const;

function isPersonId(id: string): id is PersonId {
  return Object.prototype.hasOwnProperty.call(FIXTURE_PEOPLE, id);
}

/** Stable color for an initials pair, matching the demo palette when known. */
export function colorForInitials(initials: string): string {
  if (isPersonId(initials)) {
    return FIXTURE_PEOPLE[initials].color;
  }

  let hash = 0;
  for (const char of initials) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return PERSON_COLORS[hash % PERSON_COLORS.length] ?? "#3d4a5c";
}

/** Fixture person, or a generated one so an unknown initials pair still renders. */
export function personById(id: string): Person {
  if (isPersonId(id)) {
    return FIXTURE_PEOPLE[id];
  }

  return {
    id: id as PersonId,
    name: id,
    color: colorForInitials(id),
  };
}

export const PEOPLE: Record<PersonId, Person> = new Proxy(FIXTURE_PEOPLE, {
  get(target, prop, receiver) {
    if (typeof prop !== "string") {
      return Reflect.get(target, prop, receiver);
    }

    return personById(prop);
  },
});

const UNASSIGNED_COLOR = "#b5b1a8";

export { UNASSIGNED_COLOR };

type Seed = Omit<AnalysisRecord, "catalogOrder">;

const SEEDS: readonly Seed[] = [
  {
    id: "SA-26-114",
    title: "Doubler at aft canopy rail crack",
    identifier: "165480",
    zone: "Frame 11",
    status: "check",
    analyst: "JM",
    checker: "AK",
    approver: "DL",
    dueOn: "2026-10-08",
    repair: {
      id: "RD-0471",
      revision: "B",
      type: "Doubler",
      title: "External 2024-T3 doubler, 0.063 in, 3 rows HL10",
      detail: "2 parts · 26 fasteners",
    },
    issue: { id: "SI-0938", found: "Found Sep 22 · eddy current" },
    method: "Layer Loads",
    cases: [
      { name: "Fastener bearing, row 1", margin: 0.18 },
      { name: "Net section, skin", margin: 0.42 },
      { name: "Inter-rivet buckling", margin: 0.65 },
    ],
    log: [
      { time: "2h ago", text: "A. Kowalski left 3 comments on row-1 bearing" },
      { time: "Yesterday", text: "J. Morales submitted for check" },
      { time: "Oct 2", text: "Load case 4 (5.5g pull-up) added" },
    ],
  },
  {
    id: "SA-26-117",
    title: "Keel beam splice, corrosion blend-out",
    identifier: "165502",
    zone: "Keel",
    status: "work",
    analyst: "RT",
    checker: "AK",
    approver: "DL",
    dueOn: "2026-10-12",
    repair: {
      id: "RD-0476",
      revision: "A",
      type: "Splice",
      title: "Lap splice 7075-T6, 2 rows NAS1097",
      detail: "3 parts · 18 fasteners",
    },
    issue: { id: "SI-0951", found: "Found Sep 29 · visual" },
    method: "Layer Loads",
    cases: [
      { name: "Net tension, splice", margin: 0.07 },
      { name: "Fastener shear", margin: 0.31 },
      { name: "Blend-out Kt", margin: 0.22 },
    ],
    log: [
      { time: "40m ago", text: "R. Tanaka updated the stack-up to 3 layers" },
      { time: "Oct 3", text: "Repair RD-0476 Rev A attached" },
    ],
  },
  {
    id: "SA-26-109",
    title: "Horizontal stabilizer attach fitting rework",
    identifier: "165477",
    zone: "Tail · fitting",
    status: "rework",
    analyst: "SO",
    checker: "MB",
    approver: "DL",
    dueOn: "2026-10-02",
    repair: {
      id: "RD-0462",
      revision: "C",
      type: "Fitting",
      title: "Oversize bushing and a new lug, 17-4PH",
      detail: "1 part · 4 bolts",
    },
    issue: { id: "SI-0910", found: "Found Aug 30 · ultrasonic" },
    method: "Hand calc",
    cases: [
      { name: "Lug bearing", margin: -0.06 },
      { name: "Bolt shear", margin: 0.28 },
      { name: "Shear-out", margin: 0.12 },
    ],
    log: [
      {
        time: "Today",
        text: "S. Okafor sent it back to repair design: lug margin \u22120.06",
      },
      { time: "Sep 30", text: "Checker M. Brennan flagged lug bearing" },
    ],
  },
  {
    id: "SA-26-102",
    title: "Wing lower skin scab patch",
    identifier: "165491",
    zone: "Left wing",
    status: "ready",
    analyst: "AK",
    checker: "JM",
    approver: "DL",
    dueOn: "2026-10-06",
    repair: {
      id: "RD-0455",
      revision: "B",
      type: "Patch",
      title: "Flush scab patch, 0.080 in, 4 rows",
      detail: "1 part · 48 fasteners",
    },
    issue: { id: "SI-0897", found: "Found Aug 14 · impact" },
    method: "Layer Loads",
    cases: [
      { name: "Fastener bearing", margin: 0.24 },
      { name: "Skin net section", margin: 0.37 },
      { name: "Patch end-fastener load", margin: 0.29 },
    ],
    log: [
      { time: "3h ago", text: "J. Morales signed the check" },
      { time: "Oct 1", text: "All comments closed" },
    ],
  },
  {
    id: "SA-26-120",
    title: "Frame 7 web crack stop-drill and angle",
    identifier: "165480",
    zone: "Frame 7",
    status: "draft",
    analyst: "MB",
    checker: null,
    approver: "DL",
    dueOn: "2026-10-19",
    repair: {
      id: "RD-0480",
      revision: "A",
      type: "Reinforcement",
      title: "Stop-drill 0.25 in and an extruded angle",
      detail: "1 part · 10 fasteners",
    },
    issue: { id: "SI-0962", found: "Found Oct 2 · visual" },
    method: "FEM",
    cases: [],
    log: [
      { time: "1h ago", text: "M. Brennan created the analysis" },
      { time: "1h ago", text: "Linked repair RD-0480 Rev A" },
    ],
  },
  {
    id: "SA-26-098",
    title: "Speed brake hinge doubler",
    identifier: "165466",
    zone: "Speed brake",
    status: "done",
    analyst: "RT",
    checker: "SO",
    approver: "DL",
    dueOn: "2026-09-24",
    repair: {
      id: "RD-0449",
      revision: "C",
      type: "Doubler",
      title: "Internal doubler 2024-T3, 2 rows",
      detail: "2 parts · 22 fasteners",
    },
    issue: { id: "SI-0884", found: "Found Jul 30 · visual" },
    method: "Layer Loads",
    cases: [
      { name: "Hinge bearing", margin: 0.33 },
      { name: "Fastener shear", margin: 0.51 },
    ],
    log: [
      { time: "Sep 24", text: "D. Lindqvist approved" },
      { time: "Sep 20", text: "S. Okafor signed the check" },
    ],
  },
  {
    id: "SA-26-111",
    title: "Intake lip skin replacement",
    identifier: "165502",
    zone: "Right intake",
    status: "check",
    analyst: "SO",
    checker: "RT",
    approver: "DL",
    dueOn: "2026-10-10",
    repair: {
      id: "RD-0468",
      revision: "B",
      type: "Skin replacement",
      title: "Replace a 0.050 in section, splice both ends",
      detail: "3 parts · 64 fasteners",
    },
    issue: { id: "SI-0925", found: "Found Sep 9 · impact" },
    method: "Layer Loads",
    cases: [
      { name: "End splice bearing", margin: 0.12 },
      { name: "Pressure bending", margin: 0.4 },
    ],
    log: [
      { time: "Yesterday", text: "R. Tanaka started the check" },
      { time: "Oct 3", text: "S. Okafor submitted for check" },
    ],
  },
  {
    id: "SA-26-118",
    title: "Longeron chafe repair, forward body",
    identifier: "165491",
    zone: "Frame 5",
    status: "work",
    analyst: "JM",
    checker: "MB",
    approver: "DL",
    dueOn: "2026-10-15",
    repair: {
      id: "RD-0477",
      revision: "A",
      type: "Doubler",
      title: "Formed channel doubler, 0.071 in",
      detail: "1 part · 16 fasteners",
    },
    issue: { id: "SI-0955", found: "Found Sep 30 · visual" },
    method: "Layer Loads",
    cases: [
      { name: "Longeron crippling", margin: 0.15 },
      { name: "Fastener shear", margin: 0.44 },
    ],
    log: [{ time: "Today", text: "J. Morales ran 6 load cases" }],
  },
  {
    id: "SA-26-105",
    title: "Vertical fin rear spar cap blend",
    identifier: "165477",
    zone: "Tail · fin spar",
    status: "ready",
    analyst: "MB",
    checker: "AK",
    approver: "DL",
    dueOn: "2026-10-07",
    repair: {
      id: "RD-0458",
      revision: "A",
      type: "Blend-out",
      title: "Blend 0.030 in max, no reinforcement",
      detail: "0 parts",
    },
    issue: { id: "SI-0903", found: "Found Aug 21 · eddy current" },
    method: "Hand calc",
    cases: [
      { name: "Spar cap tension", margin: 0.09 },
      { name: "Fatigue (DFR)", margin: 0.21 },
    ],
    log: [{ time: "Yesterday", text: "A. Kowalski signed the check" }],
  },
];

export const ANALYSES: readonly AnalysisRecord[] = SEEDS.map((seed, index) => ({
  ...seed,
  catalogOrder: index,
}));

export const DEFAULT_ANALYSIS_ID = "SA-26-114";

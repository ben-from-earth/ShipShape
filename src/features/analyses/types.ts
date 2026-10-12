export const ANALYSIS_STATUSES = [
  "draft",
  "work",
  "check",
  "rework",
  "ready",
  "done",
] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export type AnalysisFilter = "all" | AnalysisStatus;

export type AnalysisSort = "catalog" | "margin" | "identifier" | "due";

export type AnalysisView = "grid" | "list";

export type PersonId = "JM" | "AK" | "RT" | "DL" | "SO" | "MB";

export type Person = {
  id: PersonId;
  name: string;
  color: string;
};

export type AnalysisCase = {
  name: string;
  margin: number;
};

export type AnalysisRecord = {
  id: string;
  title: string;
  identifier: string;
  zone: string;
  status: AnalysisStatus;
  analyst: PersonId;
  checker: PersonId | null;
  approver: PersonId;
  dueOn: string;
  repair: {
    id: string;
    revision: string;
    type: string;
    title: string;
    detail: string;
  };
  issue: {
    id: string;
    found: string;
  };
  method: string;
  cases: readonly AnalysisCase[];
  log: readonly { time: string; text: string }[];
  catalogOrder: number;
  /**
   * Display names for database rows. Demo fixtures omit this and the
   * page keeps looking people up by initials.
   */
  roster?: {
    analyst: { name: string; color: string };
    checker: { name: string; color: string } | null;
    approver: { name: string; color: string };
  };
};

export type LifecycleState =
  "done" | "current" | "rework" | "todo" | "complete";

export type LifecycleStep = {
  label: string;
  state: LifecycleState;
};

export type PersonTone = "navy" | "faint" | "ok" | "accent" | "warn";

export type AssignedPerson = {
  name: string;
  initials: string;
  color: string;
  role: string;
  state: string;
  tone: PersonTone;
};

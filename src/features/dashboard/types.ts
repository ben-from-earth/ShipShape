export type DashboardPeriod = "30D" | "90D" | "12M";

export type WorkStage = "issue" | "repair" | "analyze" | "approve";

export type AttentionFlag =
  "negative-margin" | "asset-down" | "overdue" | "due-tomorrow" | "low-margin";

export type DeltaTone = "bad" | "good" | "neutral";

export type OpenItem = {
  id: string;
  title: string;
  identifier: string;
  stage: WorkStage;
  zone: string;
  discoveredOn: string;
  owner: string | null;
  margin: number | null;
  flag: AttentionFlag | null;
  attentionOrder: number | null;
  rework: boolean;
  waitingOnSupplier: boolean;
  /**
   * Days past the due date. Omitted on demo rows, which keep the
   * canned "Overdue 4 d" attention label.
   */
  overdueDays?: number;
};

export type StageMeta = {
  id: WorkStage;
  step: string;
  label: string;
  medianDays: number;
  note: string;
  noteTone: DeltaTone;
};

export type Kpi = {
  label: string;
  value: string;
  unit: string;
  delta: string;
  deltaTone: DeltaTone;
};

export type ThroughputPoint = {
  label: string;
  opened: number;
  approved: number;
};

export type Engineer = {
  initials: string;
  name: string;
  role: string;
  colorClass: string;
  analyst: number;
  checker: number;
  /** Shown instead of analyst + checker. The authority queue is not a split bar. */
  displayCount?: number;
  fullBar?: boolean;
};

export type PipelineStage = StageMeta & {
  count: number;
  share: number;
};

export type ZoneCount = {
  name: string;
  count: number;
  share: number;
  highlighted: boolean;
};

export type AgeBucketId = "0-7" | "8-14" | "15-30" | "30+";

export type AgeBucket = {
  id: AgeBucketId;
  label: string;
  count: number;
  share: number;
};

export type EngineerRow = Engineer & {
  total: number;
  totalTone: "bad" | "neutral";
  analystShare: number;
  checkerShare: number;
};

export type AttentionRow = {
  id: string;
  title: string;
  identifier: string;
  stageLabel: string;
  owner: string;
  margin: number | null;
  flag: AttentionFlag;
  flagLabel: string;
};

export type DashboardModel = {
  period: DashboardPeriod;
  asOf: string;
  asOfLabel: string;
  assetGroupName: string;
  kpis: Kpi[];
  pipeline: PipelineStage[];
  throughputSubtitle: string;
  throughput: ThroughputPoint[];
  zones: ZoneCount[];
  aging: AgeBucket[];
  agingNote: string;
  engineers: EngineerRow[];
  attention: AttentionRow[];
};

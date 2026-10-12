import { LOW_MARGIN_THRESHOLD } from "@/config/analysis";

/** `issues.stage`. Kept here so the view-model mapper does not import Drizzle. */
export type DbWorkStage =
  | "discovered"
  | "repair_defined"
  | "analysis"
  | "review"
  | "approved"
  | "closed";

export type DbAnalysisStatus =
  "draft" | "in_progress" | "in_review" | "changes_requested" | "approved";

export type DbUserRole =
  "field_tech" | "analyst" | "checker" | "approver" | "admin";

export type DbReviewDecision =
  "pending" | "approved" | "changes_requested" | "rejected";

export type SnapshotUser = {
  id: string;
  name: string;
  initials: string;
  role: DbUserRole;
};

export type SnapshotAsset = {
  id: string;
  identifier: string;
  outOfService: boolean;
};

export type SnapshotPerson = {
  userId: string;
  name: string;
  initials: string;
  role: DbUserRole;
};

export type SnapshotReview = {
  decision: DbReviewDecision;
  reviewerRole: DbUserRole;
  decidedAt: string | null;
};

export type SnapshotAnalysis = {
  id: string;
  code: string;
  title: string;
  method: string | null;
  status: DbAnalysisStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { name: string; initials: string } | null;
  cases: { name: string; margin: number }[];
  people: SnapshotPerson[];
  reviews: SnapshotReview[];
};

export type SnapshotRevision = {
  rev: string;
  detail: string | null;
  createdAt: string;
  analyses: SnapshotAnalysis[];
};

export type SnapshotRepair = {
  id: string;
  code: string;
  title: string;
  type: string | null;
  createdAt: string;
  revisions: SnapshotRevision[];
};

export type SnapshotTransition = {
  at: string;
  toStage: DbWorkStage;
};

export type SnapshotActivity = {
  at: string;
  message: string;
  entityId: string;
};

export type SnapshotIssue = {
  id: string;
  code: string;
  zone: string | null;
  description: string;
  stage: DbWorkStage;
  /** Calendar day from `issues.discovered_at`. Age prefers stage transitions. */
  discoveredAt: string;
  locationLabel: string | null;
  assetId: string;
  assetIdentifier: string;
  assetOutOfService: boolean;
  reporterName: string | null;
  transitions: SnapshotTransition[];
  repairs: SnapshotRepair[];
  activity: SnapshotActivity[];
};

export type TenantSnapshot = {
  orgName: string;
  threshold: number;
  assetGroupName: string;
  users: SnapshotUser[];
  assets: SnapshotAsset[];
  issues: SnapshotIssue[];
};

export function emptySnapshot(): TenantSnapshot {
  return {
    orgName: "",
    threshold: LOW_MARGIN_THRESHOLD,
    assetGroupName: "",
    users: [],
    assets: [],
    issues: [],
  };
}

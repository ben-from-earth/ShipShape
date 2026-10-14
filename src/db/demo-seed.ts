import type { InferInsertModel } from "drizzle-orm";

import {
  DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS,
  activityLog,
  analyses,
  analysisCases,
  analysisPeople,
  assetGroups,
  assets,
  documentChunks,
  documents,
  issueMedia,
  issues,
  organizations,
  repairRevisions,
  repairs,
  reviews,
  stageTransitions,
  toolRuns,
  users,
} from "./schema";

/**
 * Sample rows for local development. The T-45 group is demo data.
 * `asset_type` is a free label; nothing in the schema is aircraft-specific.
 * Fixed ids make `pnpm db:seed` safe to run again.
 */
export const demoIds = {
  organization: "10000000-0000-4000-8000-000000000001",
  fieldTech: "10000000-0000-4000-8000-000000000011",
  analyst: "10000000-0000-4000-8000-000000000012",
  checker: "10000000-0000-4000-8000-000000000013",
  approver: "10000000-0000-4000-8000-000000000014",
  assetGroup: "10000000-0000-4000-8000-000000000021",
  asset: "10000000-0000-4000-8000-000000000022",
  issue: "10000000-0000-4000-8000-000000000031",
  issueMedia: "10000000-0000-4000-8000-000000000032",
  repair: "10000000-0000-4000-8000-000000000041",
  repairRevision: "10000000-0000-4000-8000-000000000042",
  analysis: "10000000-0000-4000-8000-000000000051",
  analysisCase: "10000000-0000-4000-8000-000000000052",
  toolRun: "10000000-0000-4000-8000-000000000053",
  review: "10000000-0000-4000-8000-000000000054",
  stageTransition: "10000000-0000-4000-8000-000000000055",
  activity: "10000000-0000-4000-8000-000000000056",
  document: "10000000-0000-4000-8000-000000000061",
  documentChunk: "10000000-0000-4000-8000-000000000062",
} as const;

/**
 * Stand-in embedding: a unit vector along the first axis.
 * Real chunks will use a normalized all-MiniLM-L6-v2 vector.
 */
export function demoEmbedding(): number[] {
  return Array.from(
    { length: DOCUMENT_CHUNK_EMBEDDING_DIMENSIONS },
    (_, index) => (index === 0 ? 1 : 0),
  );
}

export const demoOrganization: InferInsertModel<typeof organizations> = {
  id: demoIds.organization,
  name: "Demo Repair Group",
};

export const demoUsers: InferInsertModel<typeof users>[] = [
  {
    id: demoIds.fieldTech,
    orgId: demoIds.organization,
    email: "avery.chen@example.com",
    name: "Avery Chen",
    initials: "AC",
    role: "field_tech",
  },
  {
    id: demoIds.analyst,
    orgId: demoIds.organization,
    email: "blake.ortiz@example.com",
    name: "Blake Ortiz",
    initials: "BO",
    role: "analyst",
  },
  {
    id: demoIds.checker,
    orgId: demoIds.organization,
    email: "casey.nguyen@example.com",
    name: "Casey Nguyen",
    initials: "CN",
    role: "checker",
  },
  {
    id: demoIds.approver,
    orgId: demoIds.organization,
    email: "drew.patel@example.com",
    name: "Drew Patel",
    initials: "DP",
    role: "approver",
  },
];

export const demoAssetGroup: InferInsertModel<typeof assetGroups> = {
  id: demoIds.assetGroup,
  orgId: demoIds.organization,
  name: "T-45 Goshawk",
  assetType: "aircraft",
};

export const demoAsset: InferInsertModel<typeof assets> = {
  id: demoIds.asset,
  orgId: demoIds.organization,
  groupId: demoIds.assetGroup,
  identifier: "DEMO-T45-001",
  name: "Demo airframe",
  model: "T-45C",
  attributes: { bureauNumber: "165000", station: "demo" },
  outOfService: false,
};

export const demoIssue: InferInsertModel<typeof issues> = {
  id: demoIds.issue,
  code: "ISS-1001",
  assetId: demoIds.asset,
  zone: "canopy",
  locationLabel: "LH canopy sill",
  location: { side: "LH", station: "FS 171" },
  description: "Sill shows a visible crack at the fastener line.",
  severity: "high",
  stage: "discovered",
  reportedBy: demoIds.fieldTech,
};

export const demoIssueMedia: InferInsertModel<typeof issueMedia> = {
  id: demoIds.issueMedia,
  issueId: demoIds.issue,
  storageKey: "demo/issues/ISS-1001/sill.jpg",
  mimeType: "image/jpeg",
  caption: "Crack at the fastener line",
  uploadedBy: demoIds.fieldTech,
};

export const demoRepair: InferInsertModel<typeof repairs> = {
  id: demoIds.repair,
  code: "REP-1001",
  issueId: demoIds.issue,
  title: "Canopy sill doubler",
  type: "doubler",
  status: "open",
};

export const demoRepairRevision: InferInsertModel<typeof repairRevisions> = {
  id: demoIds.repairRevision,
  repairId: demoIds.repair,
  rev: "A",
  detail: "Add a doubler across the cracked fastener line.",
  createdBy: demoIds.analyst,
};

export const demoAnalysis: InferInsertModel<typeof analyses> = {
  id: demoIds.analysis,
  code: "AN-1001",
  repairRevisionId: demoIds.repairRevision,
  title: "Canopy sill margin",
  method: "hand calc",
  status: "draft",
  ownerId: demoIds.analyst,
  dueDate: "2026-12-01",
};

export const demoAnalysisPeople: InferInsertModel<typeof analysisPeople>[] = [
  {
    analysisId: demoIds.analysis,
    userId: demoIds.analyst,
    role: "analyst",
  },
  {
    analysisId: demoIds.analysis,
    userId: demoIds.checker,
    role: "checker",
  },
  {
    analysisId: demoIds.analysis,
    userId: demoIds.approver,
    role: "approver",
  },
];

export const demoAnalysisCase: InferInsertModel<typeof analysisCases> = {
  id: demoIds.analysisCase,
  analysisId: demoIds.analysis,
  name: "Limit load",
  margin: "0.250",
};

export const demoToolRun: InferInsertModel<typeof toolRuns> = {
  id: demoIds.toolRun,
  analysisId: demoIds.analysis,
  tool: "layer_loads",
  toolVersion: "1",
  caseName: "Limit load",
  inputs: {
    layers: [{ name: "outer", thickness: 0.04, modulus: 10.5 }],
    load: 1000,
  },
  outputs: { criticalLayer: "outer", margin: 0.25 },
  createdBy: demoIds.analyst,
};

export const demoReview: InferInsertModel<typeof reviews> = {
  id: demoIds.review,
  analysisId: demoIds.analysis,
  reviewerId: demoIds.checker,
  decision: "pending",
};

export const demoStageTransition: InferInsertModel<typeof stageTransitions> = {
  id: demoIds.stageTransition,
  issueId: demoIds.issue,
  fromStage: null,
  toStage: "discovered",
  changedBy: demoIds.fieldTech,
};

export const demoActivity: InferInsertModel<typeof activityLog> = {
  id: demoIds.activity,
  orgId: demoIds.organization,
  entityType: "issue",
  entityId: demoIds.issue,
  actorId: demoIds.fieldTech,
  message: "Field report ISS-1001 opened on DEMO-T45-001.",
};

export const demoDocument: InferInsertModel<typeof documents> = {
  id: demoIds.document,
  orgId: demoIds.organization,
  title: "Demo repair notes",
  storageKey: "demo/docs/repair-notes.pdf",
  mimeType: "application/pdf",
  status: "indexed",
  uploadedBy: demoIds.analyst,
};

const demoChunkText =
  "Demo note: inspect the fastener line before closing the repair.";

/** Shared local password for every seeded engineer. Not for production. */
export const DEMO_ENGINEER_PASSWORD = "dev-password";

/** Directory rows created by `pnpm db:seed` through `createEngineer`. */
export const demoEngineers = [
  { name: "Demo Analyst", email: "analyst@example.com", role: "analyst" },
  { name: "Demo Reviewer", email: "reviewer@example.com", role: "reviewer" },
  { name: "Demo Approver", email: "approver@example.com", role: "approver" },
] as const;

export const demoEngineeringTitles = {
  unassigned: "Demo unassigned analysis",
  assigned: "Demo assigned analysis",
  overdue: "Demo overdue analysis",
} as const;

/** Fixed past day so the overdue sample stays overdue. */
export const demoOverdueDay = "2020-01-01";

export const demoDocumentChunk: InferInsertModel<typeof documentChunks> = {
  id: demoIds.documentChunk,
  documentId: demoIds.document,
  index: 0,
  text: demoChunkText,
  startOffset: 0,
  endOffset: demoChunkText.length,
  pageStart: 1,
  pageEnd: 1,
  embedding: demoEmbedding(),
};

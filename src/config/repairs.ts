/** Stored on `repairs.status`. Client code can import this list. */
export const REPAIR_STATUSES = [
  "draft",
  "written",
  "in_review",
  "approved",
  "awaiting_analysis",
  "analysis_approved",
  "complete",
] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const MAX_REPAIR_TITLE_LENGTH = 200;
export const MAX_REPAIR_TYPE_LENGTH = 200;
export const MAX_REPAIR_CODE_LENGTH = 64;

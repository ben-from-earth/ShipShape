/**
 * Fallback low-margin threshold (0.10).
 *
 * The tenant snapshot prefers `organizations.low_margin_threshold`
 * and uses this value when the organization row is missing or the
 * database is not configured. Negative margins are always red.
 */
export const LOW_MARGIN_THRESHOLD = 0.1;

/** Stored on `analyses.status`. Same labels as the `analysis_status` enum. */
export const ANALYSIS_DB_STATUSES = [
  "draft",
  "in_progress",
  "in_review",
  "changes_requested",
  "approved",
] as const;

export type AnalysisDbStatus = (typeof ANALYSIS_DB_STATUSES)[number];

export const MAX_ANALYSIS_TITLE_LENGTH = 200;
export const MAX_ANALYSIS_METHOD_LENGTH = 200;
export const MAX_ANALYSIS_LOAD_CASE_LENGTH = 200;
export const MAX_ANALYSIS_REVISION_LENGTH = 32;
export const MAX_ANALYSIS_CODE_LENGTH = 64;

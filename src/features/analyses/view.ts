/**
 * Page shape for one analysis.
 *
 * TODO(#33): replace this module with `Analysis` and `AnalysisDbStatus`
 * from `@/schemas` once `src/schemas/analyses.ts` is on main. Map that
 * record's `loadCase` and `margin` into `loadCases`, and attach the
 * repair code, revision, and finding from the repair read.
 */

/** Same values as the `analysis_status` enum. */
export const ANALYSIS_PAGE_STATUSES = [
  "draft",
  "in_progress",
  "in_review",
  "changes_requested",
  "approved",
] as const;

export type AnalysisPageStatus = (typeof ANALYSIS_PAGE_STATUSES)[number];

export const ANALYSIS_PAGE_STATUS_LABEL = {
  draft: "Draft",
  in_progress: "In progress",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
} as const satisfies Record<AnalysisPageStatus, string>;

/** Lengths the create form checks until #33 exports them from config. */
export const MAX_ANALYSIS_TITLE_LENGTH = 200;
export const MAX_ANALYSIS_METHOD_LENGTH = 200;
export const MAX_ANALYSIS_LOAD_CASE_LENGTH = 200;
export const MAX_ANALYSIS_REVISION_LENGTH = 32;

export const MIN_ANALYSIS_MARGIN = -99999.999;
export const MAX_ANALYSIS_MARGIN = 99999.999;

export type AnalysisLoadCase = {
  name: string;
  margin: number | null;
};

export type AnalysisView = {
  id: string;
  code: string;
  title: string;
  method: string | null;
  status: AnalysisPageStatus;
  repair: {
    id: string;
    code: string;
    revision: string;
    title: string;
  };
  finding: {
    id: string;
    code: string;
  };
  loadCases: readonly AnalysisLoadCase[];
};

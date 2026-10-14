import { ANALYSIS_DB_STATUSES, type AnalysisDbStatus } from "@/config/analysis";
import { analysisCreateBodySchema, type AnalysisCreateBody } from "@/schemas";

export type { AnalysisCreateBody };

export const ANALYSIS_STATUS_LABEL = {
  draft: "Draft",
  in_progress: "In progress",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
} as const satisfies Record<AnalysisDbStatus, string>;

export const ANALYSIS_STATUS_OPTIONS = ANALYSIS_DB_STATUSES;

export type AnalysisDraft = {
  title: string;
  method: string;
  loadCase: string;
  margin: string;
  status: string;
  dueDate: string;
  revision: string;
};

export type AnalysisFormField = keyof AnalysisDraft;

const MARGIN_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/** Finite margin text, or null when it is blank or not a number. */
export function parseAnalysisMargin(value: string): number | null {
  const trimmed = value.trim();
  if (!MARGIN_TEXT.test(trimmed)) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function bodyFromDraft(draft: AnalysisDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: draft.title.trim(),
  };
  const dueDate = draft.dueDate.trim();
  if (dueDate) {
    body.dueDate = dueDate;
  }
  return body;
}

function messageFor(field: string, draft: AnalysisDraft): string {
  if (field === "title") {
    return draft.title.trim() ? "Title is too long." : "A title is required.";
  }
  if (field === "dueDate") {
    return "Use YYYY-MM-DD.";
  }
  return "Check this field.";
}

/**
 * Problems with a create-analysis draft, checked with `analysisCreateBodySchema`.
 * Title is required. Due date is optional. An empty object means the draft can be posted.
 */
export function analysisFormErrors(
  draft: AnalysisDraft,
): Partial<Record<AnalysisFormField, string>> {
  const parsed = analysisCreateBodySchema.safeParse(bodyFromDraft(draft));
  if (parsed.success) {
    return {};
  }

  const errors: Partial<Record<AnalysisFormField, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string" || errors[key as AnalysisFormField]) {
      continue;
    }
    if (key === "title" || key === "dueDate") {
      errors[key] = messageFor(key, draft);
    }
  }
  return errors;
}

/** Parsed body for POST /api/repairs/[id]/analyses. Throws when the draft is invalid. */
export function toAnalysisFields(draft: AnalysisDraft): AnalysisCreateBody {
  return analysisCreateBodySchema.parse(bodyFromDraft(draft));
}

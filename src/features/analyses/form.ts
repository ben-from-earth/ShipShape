import { z } from "zod";

import {
  analysisConclusionSchema,
  analysisCreateSchema,
  analysisDbStatusSchema,
  analysisMarginSchema,
  type AnalysisDbStatus,
} from "@/schemas";

/**
 * POST body for `/api/repairs/[id]/analyses`.
 *
 * TODO: replace this stand-in with
 * `import { analysisCreateBodySchema } from "@/schemas"`
 * when the analyses route exports it from `src/schemas/analyses.ts`.
 * `repairId` stays the path id and is not a field on this object.
 */
export const analysisCreateBodySchema = z.strictObject({
  title: analysisCreateSchema.shape.title,
  method: analysisCreateSchema.shape.method,
  loadCase: analysisCreateSchema.shape.loadCase,
  margin: analysisMarginSchema,
  status: analysisCreateSchema.shape.status,
  dueDate: analysisCreateSchema.shape.dueDate,
  revision: analysisCreateSchema.shape.revision,
});

/** Conclusions from `analysisConclusionSchema`. The create body does not send one. */
export const ANALYSIS_CONCLUSIONS = analysisConclusionSchema.options;

export const ANALYSIS_STATUS_LABEL = {
  draft: "Draft",
  in_progress: "In progress",
  in_review: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
} as const satisfies Record<AnalysisDbStatus, string>;

export const ANALYSIS_STATUS_OPTIONS = analysisDbStatusSchema.options;

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

export type AnalysisCreateBody = z.infer<typeof analysisCreateBodySchema>;

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
  const method = draft.method.trim();
  const loadCase = draft.loadCase.trim();
  const status = draft.status.trim();
  const dueDate = draft.dueDate.trim();
  const revision = draft.revision.trim();
  const marginText = draft.margin.trim();

  if (method) {
    body.method = method;
  }
  if (loadCase) {
    body.loadCase = loadCase;
  }
  if (marginText) {
    body.margin = parseAnalysisMargin(marginText) ?? marginText;
  }
  if (status) {
    body.status = status;
  }
  if (dueDate) {
    body.dueDate = dueDate;
  }
  if (revision) {
    body.revision = revision;
  }
  return body;
}

function messageFor(field: string, draft: AnalysisDraft): string {
  if (field === "title") {
    return draft.title.trim() ? "Title is too long." : "A title is required.";
  }
  if (field === "method") {
    return "Method is too long.";
  }
  if (field === "loadCase") {
    return "Load case is too long.";
  }
  if (field === "margin") {
    const margin = parseAnalysisMargin(draft.margin);
    if (!draft.margin.trim() || margin == null) {
      return draft.margin.trim() ? "Enter a margin." : "A margin is required.";
    }
    return "Margin is out of range.";
  }
  if (field === "status") {
    return "Choose a status.";
  }
  if (field === "dueDate") {
    return "Use YYYY-MM-DD.";
  }
  if (field === "revision") {
    return "Revision is too long.";
  }
  return "Check this field.";
}

/**
 * Problems with a create-analysis draft, checked with `analysisCreateBodySchema`.
 * An empty object means the draft can be posted.
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
    if (
      key === "title" ||
      key === "method" ||
      key === "loadCase" ||
      key === "margin" ||
      key === "status" ||
      key === "dueDate" ||
      key === "revision"
    ) {
      errors[key] = messageFor(key, draft);
    }
  }
  if (!draft.margin.trim() && !errors.margin) {
    errors.margin = "A margin is required.";
  }
  return errors;
}

/** Parsed body for POST /api/repairs/[id]/analyses. Throws when the draft is invalid. */
export function toAnalysisFields(draft: AnalysisDraft): AnalysisCreateBody {
  return analysisCreateBodySchema.parse(bodyFromDraft(draft));
}

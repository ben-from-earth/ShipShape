import {
  ANALYSIS_PAGE_STATUSES,
  MAX_ANALYSIS_LOAD_CASE_LENGTH,
  MAX_ANALYSIS_MARGIN,
  MAX_ANALYSIS_METHOD_LENGTH,
  MAX_ANALYSIS_REVISION_LENGTH,
  MAX_ANALYSIS_TITLE_LENGTH,
  MIN_ANALYSIS_MARGIN,
  type AnalysisPageStatus,
} from "./view";

export type AnalysisDraft = {
  title: string;
  method: string;
  loadCase: string;
  margin: string;
  status: string;
  revision: string;
};

export type AnalysisFormField = keyof AnalysisDraft;

/**
 * Body the create form will post once the analyses route exists.
 * `repairId` stays on the page. Blank method, load case, status, and
 * revision are omitted.
 *
 * TODO(#33): parse this with `analysisCreateSchema` from `@/schemas`.
 */
export type AnalysisFormFields = {
  title: string;
  method?: string;
  loadCase?: string;
  margin: number;
  status?: AnalysisPageStatus;
  revision?: string;
};

const MARGIN_TEXT = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

function isPageStatus(value: string): value is AnalysisPageStatus {
  return (ANALYSIS_PAGE_STATUSES as readonly string[]).includes(value);
}

/** Finite margin, or null when the text is blank or not a number. */
export function parseAnalysisMargin(value: string): number | null {
  const trimmed = value.trim();
  if (!MARGIN_TEXT.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Problems with a create-analysis draft.
 * An empty object means the draft can be kept. Nothing is posted.
 */
export function analysisFormErrors(
  draft: AnalysisDraft,
): Partial<Record<AnalysisFormField, string>> {
  const errors: Partial<Record<AnalysisFormField, string>> = {};
  const title = draft.title.trim();
  const method = draft.method.trim();
  const loadCase = draft.loadCase.trim();
  const status = draft.status.trim();
  const revision = draft.revision.trim();
  const marginText = draft.margin.trim();

  if (!title) {
    errors.title = "A title is required.";
  } else if (title.length > MAX_ANALYSIS_TITLE_LENGTH) {
    errors.title = "Title is too long.";
  }

  if (method.length > MAX_ANALYSIS_METHOD_LENGTH) {
    errors.method = "Method is too long.";
  }

  if (loadCase.length > MAX_ANALYSIS_LOAD_CASE_LENGTH) {
    errors.loadCase = "Load case is too long.";
  }

  if (!marginText) {
    errors.margin = "A margin is required.";
  } else {
    const margin = parseAnalysisMargin(marginText);
    if (margin == null) {
      errors.margin = "Enter a margin.";
    } else if (margin < MIN_ANALYSIS_MARGIN || margin > MAX_ANALYSIS_MARGIN) {
      errors.margin = "Margin is out of range.";
    }
  }

  if (status && !isPageStatus(status)) {
    errors.status = "Choose a status.";
  }

  if (revision.length > MAX_ANALYSIS_REVISION_LENGTH) {
    errors.revision = "Revision is too long.";
  }

  return errors;
}

/** Parsed create-analysis fields. Throws when the draft is invalid. */
export function toAnalysisFields(draft: AnalysisDraft): AnalysisFormFields {
  const errors = analysisFormErrors(draft);
  if (Object.keys(errors).length > 0) {
    throw new Error("Analysis draft is invalid.");
  }

  const margin = parseAnalysisMargin(draft.margin);
  if (margin == null) {
    throw new Error("Analysis draft is invalid.");
  }

  const fields: AnalysisFormFields = {
    title: draft.title.trim(),
    margin,
  };
  const method = draft.method.trim();
  const loadCase = draft.loadCase.trim();
  const status = draft.status.trim();
  const revision = draft.revision.trim();

  if (method) {
    fields.method = method;
  }
  if (loadCase) {
    fields.loadCase = loadCase;
  }
  if (isPageStatus(status)) {
    fields.status = status;
  }
  if (revision) {
    fields.revision = revision;
  }

  return fields;
}

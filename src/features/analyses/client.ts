import { isDemoData } from "@/config/demo";
import { ORG_ID_HEADER, orgId } from "@/config/org";
import {
  apiErrorSchema,
  createAnalysisResultSchema,
  type ApiErrorCode,
  type ApiErrorDetail,
  type CreateAnalysisResult,
} from "@/schemas";

import {
  toAnalysisFields,
  type AnalysisCreateBody,
  type AnalysisDraft,
  type AnalysisFormField,
} from "./form";

export type AnalysisRequestKind = "network" | "http" | "parse";

const GENERIC_ANALYSIS_ERROR = "Could not create the analysis.";
const NOT_FOUND_MESSAGE = "Repair not found.";

const ANALYSIS_FIELDS = new Set<AnalysisFormField>([
  "title",
  "method",
  "loadCase",
  "margin",
  "status",
  "dueDate",
  "revision",
]);

/**
 * An analysis that was not recorded.
 * `network` means `fetch` threw. `http` is any non-2xx status.
 * `parse` means the body was not the 201 schema.
 */
export class AnalysisRequestError extends Error {
  readonly kind: AnalysisRequestKind;
  readonly status: number | null;
  readonly code: ApiErrorCode | null;
  readonly details: readonly ApiErrorDetail[];

  constructor(
    message: string,
    options: {
      kind: AnalysisRequestKind;
      status?: number | null;
      code?: ApiErrorCode | null;
      details?: readonly ApiErrorDetail[];
      cause?: unknown;
    },
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "AnalysisRequestError";
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.details = options.details ?? [];
  }
}

/**
 * Where a failed create should be shown.
 * 404 `not_found` is a form error. A 400 detail on a form field is that field.
 * Anything else is generic.
 */
export function analysisRequestProblems(error: AnalysisRequestError): {
  form: string | null;
  fields: Partial<Record<AnalysisFormField, string>>;
} {
  if (
    error.status === 404 &&
    (error.code === "not_found" || error.code === null)
  ) {
    return { form: NOT_FOUND_MESSAGE, fields: {} };
  }

  if (error.status === 400) {
    const fields: Partial<Record<AnalysisFormField, string>> = {};
    for (const detail of error.details) {
      if (isAnalysisField(detail.path) && !fields[detail.path]) {
        fields[detail.path] = detail.message;
      }
    }
    if (Object.keys(fields).length > 0) {
      return { form: null, fields };
    }
  }

  return { form: GENERIC_ANALYSIS_ERROR, fields: {} };
}

function isAnalysisField(path: string): path is AnalysisFormField {
  return ANALYSIS_FIELDS.has(path as AnalysisFormField);
}

function readErrorBody(payload: unknown): {
  code: ApiErrorCode | null;
  message: string | null;
  details: ApiErrorDetail[];
} {
  const parsed = apiErrorSchema.safeParse(payload);
  if (!parsed.success) {
    return { code: null, message: null, details: [] };
  }
  return {
    code: parsed.data.error.code,
    message: parsed.data.error.message,
    details: parsed.data.error.details ?? [],
  };
}

async function errorFromResponse(
  response: Response,
): Promise<AnalysisRequestError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return new AnalysisRequestError(
      response.status === 404 ? NOT_FOUND_MESSAGE : GENERIC_ANALYSIS_ERROR,
      { kind: "http", status: response.status },
    );
  }

  const body = readErrorBody(payload);
  const notFound = response.status === 404 && body.code === "not_found";
  return new AnalysisRequestError(
    notFound ? NOT_FOUND_MESSAGE : GENERIC_ANALYSIS_ERROR,
    {
      kind: "http",
      status: response.status,
      code: body.code,
      details: body.details,
    },
  );
}

function demoCreated(
  _repairId: string,
  fields: AnalysisCreateBody,
): CreateAnalysisResult {
  const createdAt = new Date().toISOString();
  return createAnalysisResultSchema.parse({
    id: crypto.randomUUID(),
    code: "AN-DEMO",
    title: fields.title,
    status: fields.assigneeId === undefined ? "unassigned" : "assigned",
    assigneeId: fields.assigneeId ?? null,
    dueDate: fields.dueDate ?? null,
    createdBy: null,
    approvedAt: null,
    createdAt,
    updatedAt: createdAt,
  });
}

/**
 * POST /api/repairs/[id]/analyses with the create body and `x-org-id`.
 * Demo mode returns a local 201 and does not call `fetch`.
 */
export async function createAnalysis(
  repairId: string,
  draft: AnalysisDraft,
): Promise<CreateAnalysisResult> {
  const fields = toAnalysisFields(draft);

  if (isDemoData()) {
    return demoCreated(repairId, fields);
  }

  let response: Response;
  try {
    response = await fetch(
      `/api/repairs/${encodeURIComponent(repairId)}/analyses`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [ORG_ID_HEADER]: orgId(),
        },
        body: JSON.stringify(fields),
      },
    );
  } catch (cause) {
    throw new AnalysisRequestError(GENERIC_ANALYSIS_ERROR, {
      kind: "network",
      cause,
    });
  }

  if (!response.ok) {
    throw await errorFromResponse(response);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new AnalysisRequestError(GENERIC_ANALYSIS_ERROR, {
      kind: "parse",
      status: response.status,
      cause,
    });
  }

  const parsed = createAnalysisResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AnalysisRequestError(GENERIC_ANALYSIS_ERROR, {
      kind: "parse",
      status: response.status,
      cause: parsed.error,
    });
  }

  return parsed.data;
}

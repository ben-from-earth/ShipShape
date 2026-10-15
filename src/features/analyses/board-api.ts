import { isDemoData } from "@/config/demo";
import { ORG_ID_HEADER, orgId } from "@/config/org";
import {
  analysisAttachmentSchema,
  analysisCommentSchema,
  analysisSchema,
  analysisSummarySchema,
  analysisTransitionBodySchema,
  analysisTransitionResultSchema,
  apiErrorSchema,
  commentCreateBodySchema,
  engineerSchema,
  type Analysis,
  type AnalysisAttachment,
  type AnalysisComment,
  type AnalysisSummary,
  type AnalysisTransitionBody,
  type Engineer,
} from "@/schemas";

/**
 * Analyses requests send `x-org-id` and rely on the `engineer_session`
 * cookie. Outside production the server still accepts `x-engineer-id`
 * when that cookie is missing; this client does not send the header.
 */

const STATUS_MESSAGE: Record<number, string> = {
  401: "Sign in as an engineer.",
  403: "That action is not allowed.",
  404: "That analysis was not found.",
  409: "That action is not allowed from this status.",
  422: "That assignee cannot take the analysis.",
};

const LOAD_ERROR = "Could not load analyses.";
const UPDATE_ERROR = "Could not update the analysis.";
const ORG_ERROR = "Organization error.";

export function analysisStatusMessage(status: number): string | null {
  return STATUS_MESSAGE[status] ?? null;
}

/** A failed analyses request. `status` is null when the network failed. */
export class BoardApiError extends Error {
  readonly status: number | null;

  constructor(status: number | null, message: string) {
    super(message);
    this.name = "BoardApiError";
    this.status = status;
  }
}

type Parser<T> = {
  safeParse: (
    value: unknown,
  ) => { success: true; data: T } | { success: false };
};

export async function listBoardAnalyses(): Promise<Analysis[]> {
  return requestJson({
    path: "/api/analyses",
    schema: analysisSchema.array(),
    fallback: LOAD_ERROR,
  });
}

export async function fetchAnalysisSummary(): Promise<AnalysisSummary> {
  return requestJson({
    path: "/api/analyses/summary",
    schema: analysisSummarySchema,
    fallback: LOAD_ERROR,
  });
}

export async function fetchEngineers(): Promise<Engineer[]> {
  return requestJson({
    path: "/api/engineers",
    schema: engineerSchema.array(),
    fallback: LOAD_ERROR,
  });
}

export async function fetchAnalysis(id: string): Promise<Analysis> {
  return requestJson({
    path: `/api/analyses/${encodeURIComponent(id)}`,
    schema: analysisSchema,
    fallback: LOAD_ERROR,
  });
}

export async function fetchComments(id: string): Promise<AnalysisComment[]> {
  return requestJson({
    path: `/api/analyses/${encodeURIComponent(id)}/comments`,
    schema: analysisCommentSchema.array(),
    fallback: LOAD_ERROR,
  });
}

export async function fetchAttachments(
  id: string,
): Promise<AnalysisAttachment[]> {
  return requestJson({
    path: `/api/analyses/${encodeURIComponent(id)}/attachments`,
    schema: analysisAttachmentSchema.array(),
    fallback: LOAD_ERROR,
  });
}

export async function transitionAnalysis(
  id: string,
  body: AnalysisTransitionBody,
): Promise<Analysis> {
  const parsed = analysisTransitionBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new BoardApiError(422, STATUS_MESSAGE[422]!);
  }
  return requestJson({
    path: `/api/analyses/${encodeURIComponent(id)}/transitions`,
    method: "POST",
    body: parsed.data,
    schema: analysisTransitionResultSchema,
    fallback: UPDATE_ERROR,
  });
}

export async function addAnalysisComment(
  id: string,
  body: string,
): Promise<AnalysisComment> {
  const parsed = commentCreateBodySchema.safeParse({ body });
  if (!parsed.success) {
    throw new BoardApiError(422, UPDATE_ERROR);
  }
  return requestJson({
    path: `/api/analyses/${encodeURIComponent(id)}/comments`,
    method: "POST",
    body: parsed.data,
    schema: analysisCommentSchema,
    fallback: UPDATE_ERROR,
  });
}

export async function uploadAnalysisAttachment(
  id: string,
  file: File,
): Promise<AnalysisAttachment> {
  const form = new FormData();
  form.set("file", file);
  return request({
    path: `/api/analyses/${encodeURIComponent(id)}/attachments`,
    method: "POST",
    body: form,
    schema: analysisAttachmentSchema,
    fallback: UPDATE_ERROR,
  });
}

async function requestJson<T>(options: {
  path: string;
  schema: Parser<T>;
  fallback: string;
  method?: "GET" | "POST";
  body?: unknown;
}): Promise<T> {
  return request({
    ...options,
    json: options.body !== undefined,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function request<T>(options: {
  path: string;
  schema: Parser<T>;
  fallback: string;
  method?: "GET" | "POST";
  body?: BodyInit;
  json?: boolean;
}): Promise<T> {
  if (isDemoData()) {
    throw new BoardApiError(null, "Demo data does not call the analyses API.");
  }

  let response: Response;
  try {
    response = await fetch(options.path, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      headers: {
        [ORG_ID_HEADER]: orgId(),
        ...(options.json ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body,
    });
  } catch {
    throw new BoardApiError(null, options.fallback);
  }

  if (!response.ok) {
    throw new BoardApiError(
      response.status,
      (await failureMessage(response)) ??
        analysisStatusMessage(response.status) ??
        options.fallback,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new BoardApiError(response.status, options.fallback);
  }

  const parsed = options.schema.safeParse(payload);
  if (!parsed.success) {
    throw new BoardApiError(response.status, options.fallback);
  }
  return parsed.data;
}

/**
 * A missing or unknown `x-org-id` is the same organization error the
 * other clients show. The header is still sent on every request.
 */
async function failureMessage(response: Response): Promise<string | null> {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    if (!parsed.success) {
      return null;
    }
    const paths = parsed.data.error.details?.map((detail) => detail.path) ?? [];
    if (
      parsed.data.error.code === "invalid_org_id" ||
      parsed.data.error.code === "unknown_organization" ||
      paths.includes(ORG_ID_HEADER)
    ) {
      return ORG_ERROR;
    }
  } catch {
    return null;
  }
  return null;
}

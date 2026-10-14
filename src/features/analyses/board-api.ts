import { isDemoData } from "@/config/demo";
import { ORG_ID_HEADER, orgId } from "@/config/org";
import {
  analysisAttachmentSchema,
  analysisCommentSchema,
  analysisSchema,
  analysisTransitionBodySchema,
  analysisTransitionResultSchema,
  apiErrorSchema,
  commentCreateBodySchema,
  type Analysis,
  type AnalysisAttachment,
  type AnalysisComment,
  type AnalysisTransitionBody,
} from "@/schemas";

/**
 * Temporary engineer header until sessions exist.
 * TODO(#13): send the signed-in engineer instead of this header.
 */
export const ENGINEER_ID_HEADER = "x-engineer-id";

const STATUS_MESSAGE: Record<number, string> = {
  401: "Sign in as an engineer.",
  403: "That action is not allowed.",
  404: "That analysis was not found.",
  409: "That action is not allowed from this status.",
  422: "That assignee cannot take the analysis.",
};

const LOAD_ERROR = "Could not load analyses.";
const UPDATE_ERROR = "Could not update the analysis.";

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

export async function listBoardAnalyses(
  engineerId: string,
): Promise<Analysis[]> {
  return requestJson({
    path: "/api/analyses",
    engineerId,
    schema: analysisSchema.array(),
    fallback: LOAD_ERROR,
  });
}

export async function fetchAnalysis(
  id: string,
  engineerId: string,
): Promise<Analysis> {
  return requestJson({
    path: `/api/analyses/${encodeURIComponent(id)}`,
    engineerId,
    schema: analysisSchema,
    fallback: LOAD_ERROR,
  });
}

export async function fetchComments(
  id: string,
  engineerId: string,
): Promise<AnalysisComment[]> {
  return requestJson({
    path: `/api/analyses/${encodeURIComponent(id)}/comments`,
    engineerId,
    schema: analysisCommentSchema.array(),
    fallback: LOAD_ERROR,
  });
}

export async function fetchAttachments(
  id: string,
  engineerId: string,
): Promise<AnalysisAttachment[]> {
  return requestJson({
    path: `/api/analyses/${encodeURIComponent(id)}/attachments`,
    engineerId,
    schema: analysisAttachmentSchema.array(),
    fallback: LOAD_ERROR,
  });
}

export async function transitionAnalysis(
  id: string,
  engineerId: string,
  body: AnalysisTransitionBody,
): Promise<Analysis> {
  const parsed = analysisTransitionBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new BoardApiError(422, STATUS_MESSAGE[422]!);
  }
  return requestJson({
    path: `/api/analyses/${encodeURIComponent(id)}/transitions`,
    method: "POST",
    engineerId,
    body: parsed.data,
    schema: analysisTransitionResultSchema,
    fallback: UPDATE_ERROR,
  });
}

export async function addAnalysisComment(
  id: string,
  engineerId: string,
  body: string,
): Promise<AnalysisComment> {
  const parsed = commentCreateBodySchema.safeParse({ body });
  if (!parsed.success) {
    throw new BoardApiError(422, UPDATE_ERROR);
  }
  return requestJson({
    path: `/api/analyses/${encodeURIComponent(id)}/comments`,
    method: "POST",
    engineerId,
    body: parsed.data,
    schema: analysisCommentSchema,
    fallback: UPDATE_ERROR,
  });
}

export async function uploadAnalysisAttachment(
  id: string,
  engineerId: string,
  file: File,
): Promise<AnalysisAttachment> {
  const form = new FormData();
  form.set("file", file);
  return request({
    path: `/api/analyses/${encodeURIComponent(id)}/attachments`,
    method: "POST",
    engineerId,
    body: form,
    schema: analysisAttachmentSchema,
    fallback: UPDATE_ERROR,
  });
}

async function requestJson<T>(options: {
  path: string;
  engineerId: string;
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
  engineerId: string;
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
      headers: {
        [ORG_ID_HEADER]: orgId(),
        [ENGINEER_ID_HEADER]: options.engineerId,
        ...(options.json ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body,
    });
  } catch {
    throw new BoardApiError(null, options.fallback);
  }

  if (!response.ok) {
    await readApiError(response);
    throw new BoardApiError(
      response.status,
      analysisStatusMessage(response.status) ?? options.fallback,
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

async function readApiError(response: Response): Promise<void> {
  try {
    apiErrorSchema.safeParse(await response.json());
  } catch {
    // The status line still chooses the inline message.
  }
}

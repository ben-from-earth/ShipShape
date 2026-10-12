import { isDemoData } from "@/config/demo";
import { documentOrgId, ORG_ID_HEADER } from "@/config/org";
import {
  apiErrorSchema,
  documentSearchQuerySchema,
  documentSearchResultSchema,
  documentUploadResultSchema,
  type ApiErrorCode,
  type DocumentSearchResult,
  type DocumentUploadResult,
} from "@/schemas";

import { documentFromFile, rankDemoHits } from "./derive";
import { DEMO_SEARCH_HITS } from "./fixtures";
import { uploadIssue } from "./upload-rules";

const SEARCH_PATH = "/api/documents/search";
const UPLOAD_PATH = "/api/documents";

export type DocsRequestKind = "network" | "http" | "parse";

/**
 * A search or upload that did not succeed.
 * `network` means `fetch` threw. `http` is any non-2xx status.
 * `parse` means the body was not the schema the route promised.
 */
export class DocsRequestError extends Error {
  readonly kind: DocsRequestKind;
  readonly status: number | null;
  /** `apiErrorSchema` code when the body matched, otherwise null. */
  readonly code: ApiErrorCode | null;

  constructor(
    message: string,
    options: {
      kind: DocsRequestKind;
      status?: number | null;
      code?: ApiErrorCode | null;
      cause?: unknown;
    },
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "DocsRequestError";
    this.kind = options.kind;
    this.status = options.status ?? null;
    this.code = options.code ?? null;
  }
}

type DocsAction = "Document search" | "Document upload";

function unreachable(action: DocsAction, cause: unknown): DocsRequestError {
  return new DocsRequestError(`Could not reach ${action.toLowerCase()}.`, {
    kind: "network",
    cause,
  });
}

function messageFor(
  action: DocsAction,
  status: number,
  code: ApiErrorCode | null,
  apiMessage: string | null,
): string {
  if (code === "invalid_org_id") {
    return "The organization id must be a UUID.";
  }

  if (code === "unknown_organization") {
    return "No organization exists with that id.";
  }

  if (code === "payload_too_large" || status === 413) {
    return "The file is larger than 10 MB.";
  }

  if (code === "unsupported_media_type" || status === 415) {
    return "Use a PDF, Word, plain text, or Markdown file.";
  }

  if (apiMessage) {
    return apiMessage;
  }

  return `${action} failed (${status}).`;
}

function httpFailure(
  action: DocsAction,
  status: number,
  code: ApiErrorCode | null = null,
  apiMessage: string | null = null,
): DocsRequestError {
  return new DocsRequestError(messageFor(action, status, code, apiMessage), {
    kind: "http",
    status,
    code,
  });
}

async function errorFromResponse(
  response: Response,
  action: DocsAction,
): Promise<DocsRequestError> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return httpFailure(action, response.status);
  }

  const parsed = apiErrorSchema.safeParse(payload);
  if (!parsed.success) {
    return httpFailure(action, response.status);
  }

  return httpFailure(
    action,
    response.status,
    parsed.data.error.code,
    parsed.data.error.message,
  );
}

function parseFailure(
  action: DocsAction,
  status: number,
  cause: unknown,
): DocsRequestError {
  return new DocsRequestError(`${action} returned an unexpected response.`, {
    kind: "parse",
    status,
    cause,
  });
}

async function readJson(
  response: Response,
  action: DocsAction,
): Promise<unknown> {
  if (!response.ok) {
    throw await errorFromResponse(response, action);
  }

  try {
    return await response.json();
  } catch (cause) {
    throw parseFailure(action, response.status, cause);
  }
}

/**
 * POST /api/documents/search. The body is `documentSearchQuerySchema`
 * and a successful response is `documentSearchResultSchema`.
 * Demo hits are returned only when `isDemoData()` is on, and then
 * `fetch` is not called.
 */
export async function searchDocuments(input: {
  query: string;
  limit?: number;
}): Promise<DocumentSearchResult> {
  const body = documentSearchQuerySchema.parse(input);

  if (isDemoData()) {
    return {
      query: body.query,
      hits: rankDemoHits(DEMO_SEARCH_HITS, body.query, body.limit ?? 10),
    };
  }

  const action = "Document search" as const;
  let response: Response;

  try {
    response = await fetch(SEARCH_PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [ORG_ID_HEADER]: documentOrgId(),
      },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw unreachable(action, cause);
  }

  const payload = await readJson(response, action);
  const parsed = documentSearchResultSchema.safeParse(payload);

  if (!parsed.success) {
    throw parseFailure(action, response.status, parsed.error);
  }

  return parsed.data;
}

/**
 * POST /api/documents with the file as multipart field `file`.
 * A successful response is `documentUploadResultSchema`. Demo results
 * are returned only when `isDemoData()` is on, and then `fetch` is not called.
 */
export async function uploadDocument(
  file: Blob & { name: string; type: string },
): Promise<DocumentUploadResult> {
  const issue = uploadIssue(file);
  if (issue) {
    throw new Error(issue);
  }

  if (isDemoData()) {
    const drafted = documentFromFile(file, {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });

    if (!drafted) {
      throw new Error("Use a PDF, Word, plain text, or Markdown file.");
    }

    return documentUploadResultSchema.parse({
      id: drafted.id,
      orgId: documentOrgId(),
      title: drafted.title,
      mediaType: drafted.mediaType,
      storageKey: drafted.storageKey,
      status: "indexed",
      chunkCount: 1,
    });
  }

  const action = "Document upload" as const;
  const form = new FormData();
  form.append("file", file, file.name);

  let response: Response;

  try {
    response = await fetch(UPLOAD_PATH, {
      method: "POST",
      headers: { [ORG_ID_HEADER]: documentOrgId() },
      body: form,
    });
  } catch (cause) {
    throw unreachable(action, cause);
  }

  const payload = await readJson(response, action);
  const parsed = documentUploadResultSchema.safeParse(payload);

  if (!parsed.success) {
    throw parseFailure(action, response.status, parsed.error);
  }

  return parsed.data;
}

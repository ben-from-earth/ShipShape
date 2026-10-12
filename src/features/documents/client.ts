import { isDemoData } from "@/config/demo";
import {
  documentSchema,
  documentSearchQuerySchema,
  documentSearchResultSchema,
  type Document,
  type DocumentSearchResult,
} from "@/schemas";

import { documentFromFile, mediaTypeForFile, rankDemoHits } from "./derive";
import { DEMO_SEARCH_HITS } from "./fixtures";

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

  constructor(
    message: string,
    options: {
      kind: DocsRequestKind;
      status?: number | null;
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
  }
}

type DocsAction = "Document search" | "Document upload";

function unreachable(action: DocsAction, cause: unknown): DocsRequestError {
  return new DocsRequestError(`Could not reach ${action.toLowerCase()}.`, {
    kind: "network",
    cause,
  });
}

function httpFailure(action: DocsAction, status: number): DocsRequestError {
  return new DocsRequestError(`${action} failed (${status}).`, {
    kind: "http",
    status,
  });
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
    throw httpFailure(action, response.status);
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
      headers: { "content-type": "application/json" },
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
 * A successful response is `documentSchema`. Demo documents are
 * returned only when `isDemoData()` is on, and then `fetch` is not called.
 */
export async function uploadDocument(
  file: Blob & { name: string; type: string },
): Promise<Document> {
  if (!mediaTypeForFile(file.name, file.type)) {
    throw new Error("Unsupported document type");
  }

  if (isDemoData()) {
    const document = documentFromFile(file, {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });

    if (!document) {
      throw new Error("Unsupported document type");
    }

    return documentSchema.parse(document);
  }

  const action = "Document upload" as const;
  const form = new FormData();
  form.append("file", file, file.name);

  let response: Response;

  try {
    response = await fetch(UPLOAD_PATH, {
      method: "POST",
      body: form,
    });
  } catch (cause) {
    throw unreachable(action, cause);
  }

  const payload = await readJson(response, action);
  const parsed = documentSchema.safeParse(payload);

  if (!parsed.success) {
    throw parseFailure(action, response.status, parsed.error);
  }

  return parsed.data;
}

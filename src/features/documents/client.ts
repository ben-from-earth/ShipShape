import {
  documentSchema,
  documentSearchQuerySchema,
  documentSearchResultSchema,
  type Document,
  type DocumentSearchResult,
} from "@/schemas";

import { rankDemoHits, documentFromFile } from "./derive";
import { DEMO_SEARCH_HITS } from "./fixtures";

const SEARCH_PATH = "/api/documents/search";
const UPLOAD_PATH = "/api/documents";

/**
 * A missing App Router POST is a 404. A multipart POST with no route is
 * answered as 409 "Server Action unavailable" instead.
 */
async function routeIsMissing(response: Response): Promise<boolean> {
  if (response.status === 404) {
    return true;
  }

  if (response.status !== 409) {
    return false;
  }

  const text = await response.clone().text();
  return text.includes("Server Action unavailable");
}

/**
 * POST /api/documents/search. The body is `documentSearchQuerySchema`
 * and a successful response is `documentSearchResultSchema`.
 * A missing route falls back to ranked demo hits.
 */
export async function searchDocuments(input: {
  query: string;
  limit?: number;
}): Promise<DocumentSearchResult> {
  const body = documentSearchQuerySchema.parse(input);

  try {
    const response = await fetch(SEARCH_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return documentSearchResultSchema.parse(await response.json());
    }

    if (!(await routeIsMissing(response))) {
      throw new Error(`Search failed (${response.status})`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Search failed")) {
      throw error;
    }
  }

  return {
    query: body.query,
    hits: rankDemoHits(DEMO_SEARCH_HITS, body.query, body.limit ?? 10),
  };
}

/**
 * POST /api/documents with the file as multipart field `file`.
 * A successful response is `documentSchema`. A missing route keeps a
 * typed demo document for this session.
 */
export async function uploadDocument(
  file: Blob & { name: string; type: string },
): Promise<Document> {
  const fallback = () =>
    documentFromFile(file, {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });

  try {
    const form = new FormData();
    form.append("file", file, file.name);

    const response = await fetch(UPLOAD_PATH, {
      method: "POST",
      body: form,
    });

    if (response.ok) {
      return documentSchema.parse(await response.json());
    }

    if (!(await routeIsMissing(response))) {
      throw new Error(`Upload failed (${response.status})`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Upload failed")) {
      throw error;
    }
  }

  const document = fallback();
  if (!document) {
    throw new Error("Unsupported document type");
  }

  return documentSchema.parse(document);
}

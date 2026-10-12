import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiErrorSchema, documentSearchResultSchema } from "@/schemas";
import { searchDocuments } from "@/server/documents/search";

import { POST } from "./route";

vi.mock("@/server/documents/search", () => ({
  searchDocuments: vi.fn(),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const documentId = "550e8400-e29b-41d4-a716-446655440010";
const search = vi.mocked(searchDocuments);

const result = {
  query: "hatch",
  hits: [
    {
      documentId,
      documentTitle: "Hull inspection notes",
      snippet: "Bent support near the access hatch.",
      score: 0.8,
      chunk: {
        index: 0,
        text: "Bent support near the access hatch.",
        startOffset: 0,
        endOffset: 36,
        pageStart: 1,
        pageEnd: 1,
      },
    },
  ],
};

beforeEach(() => {
  search.mockReset();
  search.mockResolvedValue(result);
});

function searchRequest(body: unknown, org: string | null = orgId) {
  const headers = new Headers({ "content-type": "application/json" });
  if (org !== null) {
    headers.set("x-org-id", org);
  }
  return new Request("http://localhost/api/documents/search", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/documents/search", () => {
  it("validates the query and returns ranked hits", async () => {
    const response = await POST(
      searchRequest({ query: "hatch", limit: 5, documentId }),
    );
    const body = documentSearchResultSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body).toEqual(result);
    expect(search).toHaveBeenCalledWith({
      orgId,
      query: "hatch",
      limit: 5,
      documentId,
    });
  });

  it("returns 400 with details when the body is invalid", async () => {
    const response = await POST(searchRequest({ query: "   ", limit: 80 }));
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.details?.length).toBeGreaterThan(0);
    expect(search).not.toHaveBeenCalled();
  });

  it("returns 400 when the organization header is missing", async () => {
    const response = await POST(searchRequest({ query: "hatch" }, null));

    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe(
      "validation_error",
    );
    expect(search).not.toHaveBeenCalled();
  });
});

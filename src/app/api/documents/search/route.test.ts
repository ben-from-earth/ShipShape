import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiErrorSchema, documentSearchResultSchema } from "@/schemas";
import { DocumentRequestError } from "@/server/documents/errors";
import { assertOrganizationExists } from "@/server/documents/org";
import { searchDocuments } from "@/server/documents/search";

import { POST } from "./route";

vi.mock("@/server/documents/search", () => ({
  searchDocuments: vi.fn(),
}));

vi.mock("@/server/documents/org", () => ({
  assertOrganizationExists: vi.fn(async () => undefined),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const documentId = "550e8400-e29b-41d4-a716-446655440010";
const search = vi.mocked(searchDocuments);
const organizationExists = vi.mocked(assertOrganizationExists);

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
  organizationExists.mockReset();
  organizationExists.mockResolvedValue(undefined);
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
    expect(organizationExists).toHaveBeenCalledWith(orgId);
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

  it("returns invalid_org_id when the header is missing or not a UUID", async () => {
    const missing = await POST(searchRequest({ query: "hatch" }, null));
    const malformed = await POST(
      searchRequest({ query: "hatch" }, "not-a-uuid"),
    );

    expect(missing.status).toBe(400);
    expect(apiErrorSchema.parse(await missing.json()).error.code).toBe(
      "invalid_org_id",
    );
    expect(malformed.status).toBe(400);
    expect(apiErrorSchema.parse(await malformed.json()).error.code).toBe(
      "invalid_org_id",
    );
    expect(organizationExists).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("returns unknown_organization when the UUID is not stored", async () => {
    organizationExists.mockRejectedValueOnce(
      new DocumentRequestError(
        "unknown_organization",
        "No organization exists with that id.",
      ),
    );

    const response = await POST(searchRequest({ query: "hatch" }));
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("unknown_organization");
    expect(search).not.toHaveBeenCalled();
  });
});

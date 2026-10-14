import { beforeEach, describe, expect, it, vi } from "vitest";

import { summarizeAnalyses } from "@/db/engineering";
import { getTenantDb } from "@/db/tenant-db";
import { analysisSummarySchema, apiErrorSchema } from "@/schemas";

import { GET } from "./route";

vi.mock("@/db/tenant-db", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("@/db/engineering", () => ({
  summarizeAnalyses: vi.fn(),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const engineerId = "550e8400-e29b-41d4-a716-446655440011";
const execute = vi.fn();
const tenantDb = vi.mocked(getTenantDb);
const summarize = vi.mocked(summarizeAnalyses);

const summary = {
  counts: {
    unassigned: 1,
    assigned: 0,
    in_progress: 0,
    waiting_for_review: 0,
    in_review: 0,
    approved: 0,
  },
  overdue: 1,
  dueSoon: 0,
  avgDaysToApproval: null,
};

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue([
    {
      id: engineerId,
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "analyst",
      createdAt: "2026-10-13T12:00:00.000Z",
    },
  ]);
  tenantDb.mockReset();
  tenantDb.mockResolvedValue({ execute } as never);
  summarize.mockReset();
  summarize.mockResolvedValue(summary);
});

function request(engineer?: string | null) {
  const headers = new Headers({ "x-org-id": orgId });
  if (engineer !== null) {
    headers.set("x-engineer-id", engineer ?? engineerId);
  }
  return new Request("http://localhost/api/analyses/summary", { headers });
}

describe("GET /api/analyses/summary", () => {
  it("returns the tenant summary for the engineer", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(analysisSummarySchema.parse(await response.json())).toEqual(summary);
    expect(tenantDb).toHaveBeenCalledWith(orgId);
    expect(summarize).toHaveBeenCalledWith({ execute });
  });

  it("returns 401 when the engineer header is missing", async () => {
    const response = await GET(request(null));

    expect(response.status).toBe(401);
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe(
      "unauthenticated",
    );
    expect(summarize).not.toHaveBeenCalled();
  });
});

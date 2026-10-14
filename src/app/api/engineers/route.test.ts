import { beforeEach, describe, expect, it, vi } from "vitest";

import { listEngineers } from "@/db/engineering";
import { getTenantDb } from "@/db/tenant-db";
import { engineerSchema } from "@/schemas";

import { GET } from "./route";

vi.mock("@/db/tenant-db", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("@/db/engineering", () => ({
  listEngineers: vi.fn(),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const engineerId = "550e8400-e29b-41d4-a716-446655440011";
const createdAt = "2026-10-13T12:00:00.000Z";

const execute = vi.fn();
const db = { execute };
const tenantDb = vi.mocked(getTenantDb);
const list = vi.mocked(listEngineers);

const engineer = {
  id: engineerId,
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "reviewer" as const,
  createdAt,
};

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue([engineer]);
  tenantDb.mockReset();
  tenantDb.mockResolvedValue(db as never);
  list.mockReset();
  list.mockResolvedValue([engineer]);
});

describe("GET /api/engineers", () => {
  it("returns engineer names for the signed-in engineer", async () => {
    const response = await GET(
      new Request("http://localhost/api/engineers", {
        headers: {
          "x-org-id": orgId,
          "x-engineer-id": engineerId,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(engineerSchema.array().parse(await response.json())).toEqual([
      engineer,
    ]);
    expect(list).toHaveBeenCalledWith(db);
  });
});

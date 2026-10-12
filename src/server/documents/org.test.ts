import { describe, expect, it, vi } from "vitest";

import { assertOrganizationExists } from "./org";

const orgId = "550e8400-e29b-41d4-a716-446655440000";

describe("assertOrganizationExists", () => {
  it("accepts an organization the lookup can see", async () => {
    const exists = vi.fn(async () => true);

    await expect(
      assertOrganizationExists(orgId, exists),
    ).resolves.toBeUndefined();
    expect(exists).toHaveBeenCalledWith(orgId);
  });

  it("returns unknown_organization when the UUID is not stored", async () => {
    await expect(
      assertOrganizationExists(orgId, async () => false),
    ).rejects.toMatchObject({
      status: 400,
      code: "unknown_organization",
      details: [
        {
          path: "x-org-id",
          message: "No organization exists with that id.",
        },
      ],
    });
  });
});

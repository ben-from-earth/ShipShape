import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRepair } from "@/features/repairs/data";

import { REPAIR_NOT_FOUND_MESSAGE, createFindingRepair } from "./create";

vi.mock("@/features/repairs/data", () => ({
  createRepair: vi.fn(),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const findingId = "550e8400-e29b-41d4-a716-446655440031";
const actorId = "550e8400-e29b-41d4-a716-446655440011";
const repairId = "550e8400-e29b-41d4-a716-446655440051";
const createdAt = "2026-10-12T21:04:00.000Z";

const create = vi.mocked(createRepair);

const repair = {
  id: repairId,
  code: "REP-1002",
  findingId,
  title: "Replace the seal",
  type: "weld" as string | null,
  status: "open" as const,
  createdBy: actorId as string | null,
  createdAt,
  updatedAt: createdAt,
};

beforeEach(() => {
  create.mockReset();
});

describe("createFindingRepair", () => {
  it("returns the repair row from createRepair", async () => {
    create.mockResolvedValue({ kind: "ok", repair });

    const result = await createFindingRepair({
      orgId,
      findingId,
      body: { title: "Replace the seal", type: "weld", status: "open" },
      actorId,
    });

    expect(create).toHaveBeenCalledWith({
      orgId,
      findingId,
      actorId,
      title: "Replace the seal",
      type: "weld",
      status: "open",
    });
    expect(result).toEqual(repair);
  });

  it("passes a null actor and omits type and status when they are absent", async () => {
    create.mockResolvedValue({
      kind: "ok",
      repair: { ...repair, type: null, createdBy: null },
    });

    const result = await createFindingRepair({
      orgId,
      findingId,
      body: { title: "  Replace the seal  " },
      actorId: null,
    });

    expect(create).toHaveBeenCalledWith({
      orgId,
      findingId,
      actorId: null,
      title: "Replace the seal",
    });
    expect(result.createdBy).toBeNull();
    expect(result.type).toBeNull();
  });

  it("maps not_found", async () => {
    create.mockResolvedValue({ kind: "not_found" });

    const missing = await createFindingRepair({
      orgId,
      findingId,
      body: { title: "Replace the seal" },
      actorId,
    }).catch((error: unknown) => error);

    expect(missing).toMatchObject({
      code: "not_found",
      status: 404,
      message: REPAIR_NOT_FOUND_MESSAGE,
    });
  });

  it("rejects a bad id, body, or actor before calling createRepair", async () => {
    const badId = await createFindingRepair({
      orgId,
      findingId: "not-a-uuid",
      body: { title: "Replace the seal" },
      actorId,
    }).catch((error: unknown) => error);
    const badBody = await createFindingRepair({
      orgId,
      findingId,
      body: { title: "Replace the seal", status: "published" },
      actorId,
    }).catch((error: unknown) => error);
    const badActor = await createFindingRepair({
      orgId,
      findingId,
      body: { title: "Replace the seal" },
      actorId: "not-a-uuid",
    }).catch((error: unknown) => error);

    expect(badId).toMatchObject({
      code: "validation_error",
      status: 400,
      message: "id must be a UUID.",
    });
    expect(badBody).toMatchObject({
      code: "validation_error",
      status: 400,
      message: "Repair fields are invalid.",
    });
    expect(badActor).toMatchObject({
      code: "validation_error",
      status: 400,
      message: "actorId must be a UUID.",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("lets a foreign-key failure from createRepair throw", async () => {
    create.mockRejectedValue(new Error("insert violates foreign key"));

    await expect(
      createFindingRepair({
        orgId,
        findingId,
        body: { title: "Replace the seal" },
        actorId,
      }),
    ).rejects.toThrow(/foreign key/);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { advanceStage } from "@/features/findings/advance-stage";

import {
  FINDING_STAGE_CONFLICT_MESSAGE,
  FINDING_STAGE_INVALID_MESSAGE,
  FINDING_STAGE_NOT_FOUND_MESSAGE,
  changeFindingStage,
} from "./stage";

vi.mock("@/features/findings/advance-stage", () => ({
  advanceStage: vi.fn(),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const findingId = "550e8400-e29b-41d4-a716-446655440031";
const actorId = "550e8400-e29b-41d4-a716-446655440011";
const transitionedAt = "2026-10-12T21:04:00.000Z";

const advance = vi.mocked(advanceStage);

beforeEach(() => {
  advance.mockReset();
});

describe("changeFindingStage", () => {
  it("returns the transition issue id, stage, and changedAt", async () => {
    advance.mockResolvedValue({
      kind: "ok",
      stage: "repair_defined",
      transition: {
        id: "550e8400-e29b-41d4-a716-446655440041",
        issueId: findingId,
        fromStage: "discovered",
        toStage: "repair_defined",
        changedBy: actorId,
        changedAt: transitionedAt,
      },
    });

    const result = await changeFindingStage({
      orgId,
      findingId,
      body: { toStage: "repair_defined" },
      actorId,
    });

    expect(advance).toHaveBeenCalledWith({
      orgId,
      findingId,
      toStage: "repair_defined",
      actorId,
    });
    expect(result).toEqual({
      id: findingId,
      stage: "repair_defined",
      transitionedAt,
    });
  });

  it("maps not_found, invalid_transition, and conflict", async () => {
    advance.mockResolvedValue({ kind: "not_found" });
    const missing = await changeFindingStage({
      orgId,
      findingId,
      body: { toStage: "repair_defined" },
      actorId,
    }).catch((error: unknown) => error);

    advance.mockResolvedValue({ kind: "invalid_transition" });
    const refused = await changeFindingStage({
      orgId,
      findingId,
      body: { toStage: "closed" },
      actorId,
    }).catch((error: unknown) => error);

    advance.mockResolvedValue({ kind: "conflict" });
    const raced = await changeFindingStage({
      orgId,
      findingId,
      body: { toStage: "repair_defined" },
      actorId,
    }).catch((error: unknown) => error);

    expect(missing).toMatchObject({
      code: "not_found",
      status: 404,
      message: FINDING_STAGE_NOT_FOUND_MESSAGE,
    });
    expect(refused).toMatchObject({
      code: "invalid_transition",
      status: 422,
      message: FINDING_STAGE_INVALID_MESSAGE,
    });
    expect(raced).toMatchObject({
      code: "conflict",
      status: 409,
      message: FINDING_STAGE_CONFLICT_MESSAGE,
    });
  });

  it("rejects a bad id, toStage, or actor before calling advanceStage", async () => {
    const badId = await changeFindingStage({
      orgId,
      findingId: "not-a-uuid",
      body: { toStage: "repair_defined" },
      actorId,
    }).catch((error: unknown) => error);
    const badStage = await changeFindingStage({
      orgId,
      findingId,
      body: { toStage: "published" },
      actorId,
    }).catch((error: unknown) => error);
    const badActor = await changeFindingStage({
      orgId,
      findingId,
      body: { toStage: "repair_defined" },
      actorId: "not-a-uuid",
    }).catch((error: unknown) => error);

    expect(badId).toMatchObject({
      code: "validation_error",
      status: 400,
      message: "id must be a UUID.",
    });
    expect(badStage).toMatchObject({
      code: "validation_error",
      status: 400,
      message: "toStage must be a work stage.",
    });
    expect(badActor).toMatchObject({
      code: "validation_error",
      status: 400,
      message: "actorId must be a UUID.",
    });
    expect(advance).not.toHaveBeenCalled();
  });

  it("passes a null actor through to advanceStage", async () => {
    advance.mockResolvedValue({
      kind: "ok",
      stage: "repair_defined",
      transition: {
        id: "550e8400-e29b-41d4-a716-446655440041",
        issueId: findingId,
        fromStage: "discovered",
        toStage: "repair_defined",
        changedBy: null,
        changedAt: transitionedAt,
      },
    });

    const result = await changeFindingStage({
      orgId,
      findingId,
      body: { toStage: "repair_defined" },
      actorId: null,
    });

    expect(advance).toHaveBeenCalledWith({
      orgId,
      findingId,
      toStage: "repair_defined",
      actorId: null,
    });
    expect(result).toEqual({
      id: findingId,
      stage: "repair_defined",
      transitionedAt,
    });
  });

  it("lets a foreign-key failure from advanceStage throw", async () => {
    advance.mockRejectedValue(new Error("insert violates foreign key"));

    await expect(
      changeFindingStage({
        orgId,
        findingId,
        body: { toStage: "repair_defined" },
        actorId,
      }),
    ).rejects.toThrow(/foreign key/);
  });
});

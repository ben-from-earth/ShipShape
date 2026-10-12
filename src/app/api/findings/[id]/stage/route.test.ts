import { beforeEach, describe, expect, it, vi } from "vitest";

import { advanceStage } from "@/features/findings/advance-stage";
import { apiErrorSchema, advanceFindingStageResultSchema } from "@/schemas";
import { DocumentRequestError } from "@/server/documents/errors";
import { assertOrganizationExists } from "@/server/documents/org";
import { temporaryActorId } from "@/server/findings/actor";
import {
  FINDING_STAGE_CONFLICT_MESSAGE,
  FINDING_STAGE_INVALID_MESSAGE,
  FINDING_STAGE_NOT_FOUND_MESSAGE,
} from "@/server/findings/stage";
import { INTERNAL_ERROR_MESSAGE } from "@/server/http/api";

import { POST } from "./route";

vi.mock("@/features/findings/advance-stage", () => ({
  advanceStage: vi.fn(),
}));

vi.mock("@/server/findings/actor", () => ({
  temporaryActorId: vi.fn(),
}));

vi.mock("@/server/documents/org", () => ({
  assertOrganizationExists: vi.fn(async () => undefined),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const findingId = "550e8400-e29b-41d4-a716-446655440031";
const actorId = "550e8400-e29b-41d4-a716-446655440011";
const transitionedAt = "2026-10-12T21:04:00.000Z";

const advance = vi.mocked(advanceStage);
const actor = vi.mocked(temporaryActorId);
const organizationExists = vi.mocked(assertOrganizationExists);

beforeEach(() => {
  advance.mockReset();
  actor.mockReset();
  organizationExists.mockReset();
  organizationExists.mockResolvedValue(undefined);
  actor.mockReturnValue(actorId);
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
});

function stageRequest(init?: {
  orgId?: string | null;
  id?: string;
  body?: unknown;
  json?: boolean;
}) {
  const headers = new Headers();
  if (init?.orgId !== null) {
    headers.set("x-org-id", init?.orgId ?? orgId);
  }
  if (init?.json !== false) {
    headers.set("content-type", "application/json");
  }
  return new Request(
    `http://localhost/api/findings/${init?.id ?? findingId}/stage`,
    {
      method: "POST",
      headers,
      body:
        init?.json === false
          ? "toStage=repair_defined"
          : JSON.stringify(init?.body ?? { toStage: "repair_defined" }),
    },
  );
}

function call(request: Request, id = findingId) {
  return POST(request, { params: Promise.resolve({ id }) });
}

describe("POST /api/findings/[id]/stage", () => {
  it("returns the ok result from advanceStage", async () => {
    const response = await call(stageRequest());
    const body = advanceFindingStageResultSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body).toEqual({
      id: findingId,
      stage: "repair_defined",
      transitionedAt,
    });
    expect(organizationExists).toHaveBeenCalledWith(orgId);
    expect(advance).toHaveBeenCalledWith({
      orgId,
      findingId,
      toStage: "repair_defined",
      actorId,
    });
  });

  it("maps not_found, invalid_transition, and conflict", async () => {
    advance.mockResolvedValueOnce({ kind: "not_found" });
    const missing = await call(stageRequest());
    advance.mockResolvedValueOnce({ kind: "invalid_transition" });
    const refused = await call(stageRequest({ body: { toStage: "closed" } }));
    advance.mockResolvedValueOnce({ kind: "conflict" });
    const raced = await call(stageRequest());

    expect(missing.status).toBe(404);
    expect(refused.status).toBe(422);
    expect(raced.status).toBe(409);
    expect(apiErrorSchema.parse(await missing.json()).error).toEqual({
      code: "not_found",
      message: FINDING_STAGE_NOT_FOUND_MESSAGE,
    });
    expect(apiErrorSchema.parse(await refused.json()).error).toEqual({
      code: "invalid_transition",
      message: FINDING_STAGE_INVALID_MESSAGE,
    });
    expect(apiErrorSchema.parse(await raced.json()).error).toEqual({
      code: "conflict",
      message: FINDING_STAGE_CONFLICT_MESSAGE,
    });
  });

  it("rejects a bad id, toStage, or actor before advanceStage", async () => {
    const badId = await call(stageRequest({ id: "finding" }), "finding");
    const badStage = await call(
      stageRequest({ body: { toStage: "published" } }),
    );
    actor.mockReturnValue(null);
    const badActor = await call(stageRequest());

    expect(badId.status).toBe(400);
    expect(apiErrorSchema.parse(await badId.json()).error.code).toBe(
      "validation_error",
    );
    expect(badStage.status).toBe(400);
    expect(apiErrorSchema.parse(await badStage.json()).error).toMatchObject({
      code: "validation_error",
      message: "toStage must be a work stage.",
    });
    expect(badActor.status).toBe(400);
    expect(apiErrorSchema.parse(await badActor.json()).error).toMatchObject({
      code: "validation_error",
      message: "actorId must be a UUID.",
    });
    expect(advance).not.toHaveBeenCalled();
  });

  it("turns a foreign-key throw into the generic 500", async () => {
    advance.mockRejectedValue(new Error("user 550e does not exist"));
    const response = await call(stageRequest());
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(500);
    expect(body.error).toEqual({
      code: "internal_error",
      message: INTERNAL_ERROR_MESSAGE,
    });
    expect(JSON.stringify(body)).not.toContain("550e");
  });

  it("keeps organization header failures on the shared error codes", async () => {
    const missingOrg = await call(stageRequest({ orgId: null }));
    organizationExists.mockRejectedValueOnce(
      new DocumentRequestError(
        "unknown_organization",
        "No organization exists with that id.",
      ),
    );
    const unknownOrg = await call(stageRequest());

    expect(missingOrg.status).toBe(400);
    expect(apiErrorSchema.parse(await missingOrg.json()).error.code).toBe(
      "invalid_org_id",
    );
    expect(unknownOrg.status).toBe(400);
    expect(apiErrorSchema.parse(await unknownOrg.json()).error.code).toBe(
      "unknown_organization",
    );
    expect(advance).not.toHaveBeenCalled();
  });
});

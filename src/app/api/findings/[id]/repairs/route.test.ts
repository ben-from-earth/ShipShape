import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRepair } from "@/features/repairs/data";
import { apiErrorSchema, createRepairResultSchema } from "@/schemas";
import { DocumentRequestError } from "@/server/documents/errors";
import { assertOrganizationExists } from "@/server/documents/org";
import { temporaryActorId } from "@/server/findings/actor";
import { INTERNAL_ERROR_MESSAGE } from "@/server/http/api";
import { REPAIR_NOT_FOUND_MESSAGE } from "@/server/repairs/create";

import { POST } from "./route";

vi.mock("@/features/repairs/data", () => ({
  createRepair: vi.fn(),
}));

vi.mock("@/server/findings/actor", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/findings/actor")
  >("@/server/findings/actor");
  return {
    temporaryActorId: vi.fn(actual.temporaryActorId),
  };
});

vi.mock("@/server/documents/org", () => ({
  assertOrganizationExists: vi.fn(async () => undefined),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const findingId = "550e8400-e29b-41d4-a716-446655440031";
const actorId = "550e8400-e29b-41d4-a716-446655440011";
const repairId = "550e8400-e29b-41d4-a716-446655440051";
const createdAt = "2026-10-12T21:04:00.000Z";

const create = vi.mocked(createRepair);
const actor = vi.mocked(temporaryActorId);
const organizationExists = vi.mocked(assertOrganizationExists);

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
  actor.mockReset();
  organizationExists.mockReset();
  organizationExists.mockResolvedValue(undefined);
  actor.mockReturnValue(actorId);
  create.mockResolvedValue({ kind: "ok", repair });
});

function repairRequest(init?: {
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
    `http://localhost/api/findings/${init?.id ?? findingId}/repairs`,
    {
      method: "POST",
      headers,
      body:
        init?.json === false
          ? "title=Replace"
          : JSON.stringify(init?.body ?? { title: "Replace the seal" }),
    },
  );
}

function call(request: Request, id = findingId) {
  return POST(request, { params: Promise.resolve({ id }) });
}

describe("POST /api/findings/[id]/repairs", () => {
  it("returns the repair from createRepair", async () => {
    const response = await call(
      repairRequest({
        body: { title: "Replace the seal", type: "weld", status: "open" },
      }),
    );
    const body = createRepairResultSchema.parse(await response.json());

    expect(response.status).toBe(201);
    expect(body).toEqual(repair);
    expect(organizationExists).toHaveBeenCalledWith(orgId);
    expect(create).toHaveBeenCalledWith({
      orgId,
      findingId,
      actorId,
      title: "Replace the seal",
      type: "weld",
      status: "open",
    });
  });

  it("passes the real null actor through to createRepair", async () => {
    const { temporaryActorId: realTemporaryActorId } = await vi.importActual<
      typeof import("@/server/findings/actor")
    >("@/server/findings/actor");
    actor.mockReset();
    actor.mockImplementation(realTemporaryActorId);
    create.mockResolvedValue({
      kind: "ok",
      repair: { ...repair, createdBy: null },
    });

    const response = await call(repairRequest());

    expect(realTemporaryActorId()).toBeNull();
    expect(response.status).toBe(201);
    expect(
      createRepairResultSchema.parse(await response.json()).createdBy,
    ).toBe(null);
    expect(create).toHaveBeenCalledWith({
      orgId,
      findingId,
      actorId: null,
      title: "Replace the seal",
    });
  });

  it("maps not_found", async () => {
    create.mockResolvedValueOnce({ kind: "not_found" });
    const response = await call(repairRequest());

    expect(response.status).toBe(404);
    expect(apiErrorSchema.parse(await response.json()).error).toEqual({
      code: "not_found",
      message: REPAIR_NOT_FOUND_MESSAGE,
    });
  });

  it("rejects a bad id, body, or actor before createRepair", async () => {
    const badId = await call(repairRequest({ id: "finding" }), "finding");
    const badBody = await call(
      repairRequest({ body: { title: "Replace the seal", code: "REP-1002" } }),
    );
    actor.mockReturnValue("not-a-uuid");
    const badActor = await call(repairRequest());

    expect(badId.status).toBe(400);
    expect(apiErrorSchema.parse(await badId.json()).error).toMatchObject({
      code: "validation_error",
      message: "id must be a UUID.",
    });
    expect(badBody.status).toBe(400);
    expect(apiErrorSchema.parse(await badBody.json()).error).toMatchObject({
      code: "validation_error",
      message: "Repair fields are invalid.",
    });
    expect(badActor.status).toBe(400);
    expect(apiErrorSchema.parse(await badActor.json()).error).toMatchObject({
      code: "validation_error",
      message: "actorId must be a UUID.",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("turns a foreign-key throw into the generic 500", async () => {
    create.mockRejectedValue(new Error("user 550e does not exist"));
    const response = await call(repairRequest());
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(500);
    expect(body.error).toEqual({
      code: "internal_error",
      message: INTERNAL_ERROR_MESSAGE,
    });
    expect(JSON.stringify(body)).not.toContain("550e");
  });

  it("keeps organization header failures on the shared error codes", async () => {
    const missingOrg = await call(repairRequest({ orgId: null }));
    organizationExists.mockRejectedValueOnce(
      new DocumentRequestError(
        "unknown_organization",
        "No organization exists with that id.",
      ),
    );
    const unknownOrg = await call(repairRequest());

    expect(missingOrg.status).toBe(400);
    expect(apiErrorSchema.parse(await missingOrg.json()).error.code).toBe(
      "invalid_org_id",
    );
    expect(unknownOrg.status).toBe(400);
    expect(apiErrorSchema.parse(await unknownOrg.json()).error.code).toBe(
      "unknown_organization",
    );
    expect(create).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAnalysis } from "@/features/analyses/write";
import { apiErrorSchema, createAnalysisResultSchema } from "@/schemas";
import { ANALYSIS_NOT_FOUND_MESSAGE } from "@/server/analyses/create";
import { DocumentRequestError } from "@/server/documents/errors";
import { assertOrganizationExists } from "@/server/documents/org";
import { temporaryActorId } from "@/server/findings/actor";

import { POST } from "./route";

vi.mock("@/features/analyses/write", () => ({
  createAnalysis: vi.fn(),
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
const repairId = "550e8400-e29b-41d4-a716-446655440051";
const analysisId = "550e8400-e29b-41d4-a716-446655440071";
const revisionId = "550e8400-e29b-41d4-a716-446655440081";
const actorId = "550e8400-e29b-41d4-a716-446655440011";
const createdAt = "2026-10-12T22:00:00.000Z";

const create = vi.mocked(createAnalysis);
const actor = vi.mocked(temporaryActorId);
const organizationExists = vi.mocked(assertOrganizationExists);

const analysis = {
  id: analysisId,
  code: "AN-1002",
  repairId,
  revisionId,
  revision: "A",
  title: "Check the joint",
  method: null,
  loadCase: "Primary",
  margin: 0.125,
  status: "draft" as const,
  createdBy: actorId as string | null,
  dueDate: null,
  createdAt,
  updatedAt: createdAt,
};

beforeEach(() => {
  create.mockReset();
  actor.mockReset();
  organizationExists.mockReset();
  organizationExists.mockResolvedValue(undefined);
  actor.mockReturnValue(actorId);
  create.mockResolvedValue({ kind: "ok", analysis });
});

function analysisRequest(init?: {
  orgId?: string | null;
  id?: string;
  body?: unknown;
}) {
  const headers = new Headers();
  if (init?.orgId !== null) {
    headers.set("x-org-id", init?.orgId ?? orgId);
  }
  headers.set("content-type", "application/json");
  return new Request(
    `http://localhost/api/repairs/${init?.id ?? repairId}/analyses`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(
        init?.body ?? { title: "Check the joint", margin: 0.125 },
      ),
    },
  );
}

function call(request: Request, id = repairId) {
  return POST(request, { params: Promise.resolve({ id }) });
}

describe("POST /api/repairs/[id]/analyses", () => {
  it("returns the analysis from createAnalysis", async () => {
    const response = await call(
      analysisRequest({
        body: {
          title: "Check the joint",
          method: null,
          loadCase: "Primary",
          margin: 0.125,
          status: "draft",
          dueDate: null,
          revision: "A",
        },
      }),
    );
    const body = createAnalysisResultSchema.parse(await response.json());

    expect(response.status).toBe(201);
    expect(body).toEqual(analysis);
    expect(organizationExists).toHaveBeenCalledWith(orgId);
    expect(create).toHaveBeenCalledWith({
      orgId,
      repairId,
      actorId,
      title: "Check the joint",
      method: null,
      loadCase: "Primary",
      margin: 0.125,
      status: "draft",
      dueDate: null,
      revision: "A",
    });
  });

  it("passes the real null actor through to createAnalysis", async () => {
    const { temporaryActorId: realTemporaryActorId } = await vi.importActual<
      typeof import("@/server/findings/actor")
    >("@/server/findings/actor");
    actor.mockReset();
    actor.mockImplementation(realTemporaryActorId);
    create.mockResolvedValue({
      kind: "ok",
      analysis: { ...analysis, createdBy: null },
    });

    const response = await call(analysisRequest());

    expect(realTemporaryActorId()).toBeNull();
    expect(response.status).toBe(201);
    expect(
      createAnalysisResultSchema.parse(await response.json()).createdBy,
    ).toBe(null);
    expect(create).toHaveBeenCalledWith({
      orgId,
      repairId,
      actorId: null,
      title: "Check the joint",
      margin: 0.125,
    });
  });

  it("maps not_found", async () => {
    create.mockResolvedValueOnce({ kind: "not_found" });
    const response = await call(analysisRequest());

    expect(response.status).toBe(404);
    expect(apiErrorSchema.parse(await response.json()).error).toEqual({
      code: "not_found",
      message: ANALYSIS_NOT_FOUND_MESSAGE,
    });
  });

  it("rejects an unknown key with path body", async () => {
    const response = await call(
      analysisRequest({
        body: { title: "Check the joint", margin: 0.125, code: "AN-1002" },
      }),
    );

    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(await response.json()).error).toMatchObject({
      code: "validation_error",
      details: [{ path: "body" }],
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a bad margin before createAnalysis", async () => {
    const response = await call(
      analysisRequest({
        body: { title: "Check the joint", margin: 1000000 },
      }),
    );

    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(await response.json()).error).toMatchObject({
      code: "validation_error",
      details: [{ path: "margin" }],
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects a non-UUID repair id before createAnalysis", async () => {
    const response = await call(analysisRequest({ id: "repair" }), "repair");

    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(await response.json()).error).toMatchObject({
      code: "validation_error",
      message: "id must be a UUID.",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("maps payload_too_large and unsupported_media_type through apiErrorSchema", async () => {
    organizationExists.mockRejectedValueOnce(
      new DocumentRequestError("payload_too_large", "The body is too large."),
    );
    const tooLarge = await call(analysisRequest());
    organizationExists.mockRejectedValueOnce(
      new DocumentRequestError(
        "unsupported_media_type",
        "That media type is not supported.",
      ),
    );
    const unsupported = await call(analysisRequest());

    expect(tooLarge.status).toBe(413);
    expect(apiErrorSchema.parse(await tooLarge.json()).error.code).toBe(
      "payload_too_large",
    );
    expect(unsupported.status).toBe(415);
    expect(apiErrorSchema.parse(await unsupported.json()).error.code).toBe(
      "unsupported_media_type",
    );
    expect(create).not.toHaveBeenCalled();
  });
});

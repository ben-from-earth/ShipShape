import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_ORGANIZATION_ID, ORG_ID_HEADER } from "@/config/org";

import {
  advanceFindingStage,
  stageRequestFailure,
  StageRequestError,
} from "./stage-client";

const findingId = "550e8400-e29b-41d4-a716-446655440031";

const moved = {
  id: findingId,
  stage: "repair_defined",
  transitionedAt: "2026-10-12T21:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("advanceFindingStage", () => {
  it("posts toStage and the organization header", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        [ORG_ID_HEADER]: DEMO_ORGANIZATION_ID,
      });
      expect(init.body).toBe(JSON.stringify({ toStage: "repair_defined" }));
      return jsonResponse(moved);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      advanceFindingStage(findingId, "repair_defined"),
    ).resolves.toEqual(moved);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/findings/${findingId}/stage`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it.each([
    [404, "not_found", "missing", "Finding not found."],
    [
      422,
      "invalid_transition",
      "That move is not allowed.",
      "That move is not allowed.",
    ],
    [409, "conflict", "stale", "This finding was moved by someone else."],
    [400, "validation_error", "bad", "Could not change the stage."],
    [500, "internal_error", "boom", "Could not change the stage."],
  ] as const)("maps HTTP %s %s", async (status, code, serverText, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code, message: serverText } }, status),
      ),
    );

    const error = await advanceFindingStage(findingId, "repair_defined").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(StageRequestError);
    expect(error).toMatchObject({
      kind: "http",
      status,
      code,
      message,
    });
    expect(stageRequestFailure(error)).toEqual({
      message,
      refresh: status === 409,
    });
  });

  it("shows a 422 message when the code is not on the shared enum yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "stage_rejected",
              message: "Analysis cannot skip review.",
            },
          },
          422,
        ),
      ),
    );

    await expect(
      advanceFindingStage(findingId, "approved"),
    ).rejects.toMatchObject({
      kind: "http",
      status: 422,
      code: null,
      message: "Analysis cannot skip review.",
    });
  });

  it.each([
    [404, "Finding not found."],
    [409, "This finding was moved by someone else."],
    [422, "Could not change the stage."],
    [400, "Could not change the stage."],
    [500, "Could not change the stage."],
  ] as const)("maps HTTP %s with no error schema", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status })),
    );

    const error = await advanceFindingStage(findingId, "analysis").catch(
      (caught: unknown) => caught,
    );

    expect(error).toMatchObject({
      kind: "http",
      status,
      code: null,
      message,
    });
    expect(stageRequestFailure(error).refresh).toBe(status === 409);
  });

  it("rejects a network failure and a body that is not the 200 schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(
      advanceFindingStage(findingId, "repair_defined"),
    ).rejects.toMatchObject({
      kind: "network",
      message: "Could not reach findings.",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ stage: "nope" }, 200)),
    );
    await expect(
      advanceFindingStage(findingId, "repair_defined"),
    ).rejects.toMatchObject({
      kind: "parse",
      message: "Findings returned an unexpected response.",
    });
    expect(stageRequestFailure(new Error("other"))).toEqual({
      message: "Could not change the stage.",
      refresh: false,
    });
  });

  it("updates local state and does not call fetch when demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const fetchMock = vi.fn(async () => jsonResponse(moved));
    vi.stubGlobal("fetch", fetchMock);

    const result = await advanceFindingStage(findingId, "analysis");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.id).toBe(findingId);
    expect(result.stage).toBe("analysis");
    expect(Number.isNaN(Date.parse(result.transitionedAt))).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_ORGANIZATION_ID, ORG_ID_HEADER } from "@/config/org";

import {
  createRepair,
  repairRequestProblems,
  RepairRequestError,
} from "./client";

const findingId = "550e8400-e29b-41d4-a716-446655440031";
const repairId = "550e8400-e29b-41d4-a716-446655440051";
const createdAt = "2026-10-12T21:04:00.000Z";

const draft = {
  title: "Replace the seal",
  type: "weld",
  status: "in_review",
};

const created = {
  id: repairId,
  code: "REP-1002",
  findingId,
  title: "Replace the seal",
  type: "weld",
  status: "in_review",
  createdBy: null,
  createdAt,
  updatedAt: createdAt,
  finding: { id: findingId, code: "FND-1002" },
  asset: {
    id: "550e8400-e29b-41d4-a716-446655440022",
    identifier: "A-0022",
    name: "Fitting",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function jsonResponse(body: unknown, status = 201): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createRepair", () => {
  it("posts title, type, and status with the organization header", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        [ORG_ID_HEADER]: DEMO_ORGANIZATION_ID,
      });
      expect(JSON.parse(String(init.body))).toEqual({
        title: "Replace the seal",
        type: "weld",
        status: "in_review",
      });
      return jsonResponse(created);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createRepair(findingId, draft)).resolves.toEqual(created);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/findings/${findingId}/repairs`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("omits blank type and status from the body", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toEqual({
        title: "Replace the seal",
      });
      return jsonResponse({
        ...created,
        type: null,
        status: "draft",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await createRepair(findingId, {
      title: "Replace the seal",
      type: " ",
      status: "",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("maps 404 to finding not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code: "not_found", message: "missing" } }, 404),
      ),
    );

    const error = await createRepair(findingId, draft).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(RepairRequestError);
    expect(error).toMatchObject({
      kind: "http",
      status: 404,
      code: "not_found",
      message: "Finding not found.",
    });
    expect(repairRequestProblems(error as RepairRequestError)).toEqual({
      form: "Finding not found.",
      fields: {},
    });
  });

  it("maps a 400 validation_error onto fields and a body path onto the form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "validation_error",
              message: "Request validation failed.",
              details: [
                { path: "title", message: "A title is required." },
                { path: "body", message: "Unknown field." },
              ],
            },
          },
          400,
        ),
      ),
    );

    const error = await createRepair(findingId, draft).catch(
      (caught: unknown) => caught,
    );

    expect(error).toMatchObject({
      kind: "http",
      status: 400,
      code: "validation_error",
    });
    expect(repairRequestProblems(error as RepairRequestError)).toEqual({
      form: "Unknown field.",
      fields: { title: "A title is required." },
    });
  });

  it("shows only the body detail when a 400 names no field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "validation_error",
              message: "Request validation failed.",
              details: [{ path: "body", message: "Unknown field." }],
            },
          },
          400,
        ),
      ),
    );

    const error = (await createRepair(findingId, draft).catch(
      (caught: unknown) => caught,
    )) as RepairRequestError;

    expect(repairRequestProblems(error)).toEqual({
      form: "Unknown field.",
      fields: {},
    });
  });

  it.each([
    [400, "invalid_org_id", "bad org"],
    [409, "conflict", "stale"],
    [422, "invalid_transition", "not allowed"],
    [500, "internal_error", "boom"],
  ] as const)(
    "maps HTTP %s %s to a generic error",
    async (status, code, serverText) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          jsonResponse(
            {
              error: {
                code,
                message: serverText,
                details: [{ path: "title", message: "A title is required." }],
              },
            },
            status,
          ),
        ),
      );

      const error = (await createRepair(findingId, draft).catch(
        (caught: unknown) => caught,
      )) as RepairRequestError;

      expect(error).toMatchObject({
        kind: "http",
        status,
        code,
        message: "Could not create the repair.",
      });
      expect(repairRequestProblems(error)).toEqual({
        form: "Could not create the repair.",
        fields: {},
      });
    },
  );

  it("maps a 404 with no error schema to finding not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 404 })),
    );

    const error = (await createRepair(findingId, draft).catch(
      (caught: unknown) => caught,
    )) as RepairRequestError;

    expect(repairRequestProblems(error)).toEqual({
      form: "Finding not found.",
      fields: {},
    });
  });

  it("rejects a network failure and a body that is not the 201 schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(createRepair(findingId, draft)).rejects.toMatchObject({
      kind: "network",
      message: "Could not reach repairs.",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ id: "nope" }, 201)),
    );
    await expect(createRepair(findingId, draft)).rejects.toMatchObject({
      kind: "parse",
      message: "Repairs returned an unexpected response.",
    });
  });

  it("returns a local 201 and does not call fetch when demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const fetchMock = vi.fn(async () => jsonResponse(created));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createRepair(findingId, draft);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.code).toBe("REP-DEMO");
    expect(result.findingId).toBe(findingId);
    expect(result.title).toBe("Replace the seal");
    expect(result.type).toBe("weld");
    expect(result.status).toBe("in_review");
    expect(result.createdBy).toBeNull();
  });
});

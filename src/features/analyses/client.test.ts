import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_ORGANIZATION_ID, ORG_ID_HEADER } from "@/config/org";

import {
  AnalysisRequestError,
  analysisRequestProblems,
  createAnalysis,
} from "./client";

const repairId = "550e8400-e29b-41d4-a716-446655440041";
const analysisId = "550e8400-e29b-41d4-a716-446655440051";
const createdAt = "2026-10-12T21:04:00.000Z";

const draft = {
  title: "Check the joint",
  method: "Hand calculation",
  loadCase: "Limit load",
  margin: "0.18",
  status: "in_review",
  dueDate: "2026-12-01",
  revision: "A",
};

const created = {
  id: analysisId,
  code: "AN-1002",
  repairId,
  revisionId: "550e8400-e29b-41d4-a716-446655440042",
  revision: "A",
  title: "Check the joint",
  method: "Hand calculation",
  loadCase: "Limit load",
  margin: 0.18,
  status: "in_review",
  createdBy: null,
  dueDate: "2026-12-01",
  createdAt,
  updatedAt: createdAt,
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

describe("createAnalysis", () => {
  it("posts the create body with the organization header", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        [ORG_ID_HEADER]: DEMO_ORGANIZATION_ID,
      });
      expect(JSON.parse(String(init.body))).toEqual({
        title: "Check the joint",
        method: "Hand calculation",
        loadCase: "Limit load",
        margin: 0.18,
        status: "in_review",
        dueDate: "2026-12-01",
        revision: "A",
      });
      return jsonResponse(created);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createAnalysis(repairId, draft)).resolves.toEqual(created);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/repairs/${repairId}/analyses`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("maps 404 not_found onto the form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code: "not_found", message: "missing" } }, 404),
      ),
    );

    const error = (await createAnalysis(repairId, draft).catch(
      (caught: unknown) => caught,
    )) as AnalysisRequestError;

    expect(analysisRequestProblems(error)).toEqual({
      form: "Repair not found.",
      fields: {},
    });
  });

  it("maps a 400 field detail onto that field", async () => {
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
                { path: "margin", message: "Enter a margin." },
              ],
            },
          },
          400,
        ),
      ),
    );

    const error = (await createAnalysis(repairId, draft).catch(
      (caught: unknown) => caught,
    )) as AnalysisRequestError;

    expect(analysisRequestProblems(error)).toEqual({
      form: null,
      fields: {
        title: "A title is required.",
        margin: "Enter a margin.",
      },
    });
  });

  it("uses a generic error for other failures, including a 400 without a field", async () => {
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

    const bodyOnly = (await createAnalysis(repairId, draft).catch(
      (caught: unknown) => caught,
    )) as AnalysisRequestError;
    expect(analysisRequestProblems(bodyOnly)).toEqual({
      form: "Could not create the analysis.",
      fields: {},
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { error: { code: "internal_error", message: "boom" } },
          500,
        ),
      ),
    );
    const server = (await createAnalysis(repairId, draft).catch(
      (caught: unknown) => caught,
    )) as AnalysisRequestError;
    expect(analysisRequestProblems(server)).toEqual({
      form: "Could not create the analysis.",
      fields: {},
    });
  });

  it("requires a margin before demo mode or fetch", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const fetchMock = vi.fn(async () => jsonResponse(created));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createAnalysis(repairId, { ...draft, margin: "" }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a local 201 and does not call fetch when demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const fetchMock = vi.fn(async () => jsonResponse(created));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createAnalysis(repairId, draft);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.code).toBe("AN-DEMO");
    expect(result.repairId).toBe(repairId);
    expect(result.title).toBe("Check the joint");
    expect(result.margin).toBe(0.18);
    expect(result.status).toBe("in_review");
    expect(result.createdBy).toBeNull();
  });
});

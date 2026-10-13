import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_ORGANIZATION_ID, ORG_ID_HEADER } from "@/config/org";

import {
  createReview,
  createReviewProblems,
  ReviewRequestError,
  submitForReview,
  submitRequestProblems,
} from "./review-client";

const analysisId = "550e8400-e29b-41d4-a716-446655440051";
const createdAt = "2026-10-13T12:00:00.000Z";

const draft = {
  decision: "changes_requested",
  comment: "Recheck the sill.",
};

const created = {
  id: "550e8400-e29b-41d4-a716-446655440054",
  analysisId,
  decision: "changes_requested",
  comment: "Recheck the sill.",
  createdAt,
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

describe("submitForReview", () => {
  it("posts an empty body with the organization header", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        [ORG_ID_HEADER]: DEMO_ORGANIZATION_ID,
      });
      expect(init.body).toBe("{}");
      return jsonResponse({ id: analysisId, status: "in_review" });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitForReview(analysisId)).resolves.toEqual({
      id: analysisId,
      status: "in_review",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/analyses/${analysisId}/submit`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("refreshes on 409 invalid_state and maps 404 to not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { error: { code: "invalid_state", message: "stale" } },
          409,
        ),
      ),
    );
    const stale = (await submitForReview(analysisId).catch(
      (caught: unknown) => caught,
    )) as ReviewRequestError;
    expect(submitRequestProblems(stale)).toEqual({
      message: "This analysis is no longer in that state.",
      fields: {},
      refresh: true,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code: "not_found", message: "missing" } }, 404),
      ),
    );
    const missing = (await submitForReview(analysisId).catch(
      (caught: unknown) => caught,
    )) as ReviewRequestError;
    expect(submitRequestProblems(missing)).toEqual({
      message: "Analysis not found.",
      fields: {},
      refresh: false,
    });
  });

  it("uses a generic error for other failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { error: { code: "internal_error", message: "boom" } },
          500,
        ),
      ),
    );
    const error = (await submitForReview(analysisId).catch(
      (caught: unknown) => caught,
    )) as ReviewRequestError;
    expect(submitRequestProblems(error)).toEqual({
      message: "Could not submit the analysis.",
      fields: {},
      refresh: false,
    });
  });

  it("returns a local 201 and does not call fetch when demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const fetchMock = vi.fn(async () => jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitForReview(analysisId)).resolves.toEqual({
      id: analysisId,
      status: "in_review",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("createReview", () => {
  it("posts the decision and comment only", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toEqual({
        decision: "changes_requested",
        comment: "Recheck the sill.",
      });
      return jsonResponse(created);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createReview(analysisId, draft)).resolves.toEqual(created);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/analyses/${analysisId}/reviews`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("maps a 400 field detail onto that field and refreshes on invalid_state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "validation_error",
              message: "Request validation failed.",
              details: [
                { path: "comment", message: "A comment is required." },
                { path: "decision", message: "Choose a decision." },
              ],
            },
          },
          400,
        ),
      ),
    );
    const invalid = (await createReview(analysisId, draft).catch(
      (caught: unknown) => caught,
    )) as ReviewRequestError;
    expect(createReviewProblems(invalid)).toEqual({
      message: null,
      fields: {
        comment: "A comment is required.",
        decision: "Choose a decision.",
      },
      refresh: false,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { error: { code: "invalid_state", message: "closed" } },
          409,
        ),
      ),
    );
    const stale = (await createReview(analysisId, draft).catch(
      (caught: unknown) => caught,
    )) as ReviewRequestError;
    expect(createReviewProblems(stale).refresh).toBe(true);
  });

  it("uses a generic error when a 400 detail is not a form field", async () => {
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
    const error = (await createReview(analysisId, draft).catch(
      (caught: unknown) => caught,
    )) as ReviewRequestError;
    expect(createReviewProblems(error)).toEqual({
      message: "Could not save the review.",
      fields: {},
      refresh: false,
    });
  });

  it("requires a comment before demo mode or fetch", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const fetchMock = vi.fn(async () => jsonResponse(created));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createReview(analysisId, { ...draft, comment: "" }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

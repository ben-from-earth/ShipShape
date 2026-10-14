import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_ORGANIZATION_ID, ORG_ID_HEADER } from "@/config/org";

import {
  BoardApiError,
  ENGINEER_ID_HEADER,
  analysisStatusMessage,
  fetchAnalysisSummary,
  listBoardAnalyses,
  transitionAnalysis,
} from "./board-api";

const engineerId = "10000000-0000-4000-8000-000000000072";
const analysisId = "10000000-0000-4000-8000-000000000085";
const createdAt = "2026-10-06T12:00:00.000Z";

const analysis = {
  id: analysisId,
  code: "AN-2005",
  title: "Edge margin",
  status: "in_review" as const,
  assigneeId: engineerId,
  dueDate: "2026-10-12",
  createdAt,
  updatedAt: createdAt,
  approvedAt: null,
  createdBy: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("analysis board API", () => {
  it("lists analyses with the engineer header", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([analysis]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listBoardAnalyses(engineerId)).resolves.toEqual([analysis]);
    expect(fetchMock).toHaveBeenCalledWith("/api/analyses", {
      method: "GET",
      headers: {
        [ORG_ID_HEADER]: DEMO_ORGANIZATION_ID,
        [ENGINEER_ID_HEADER]: engineerId,
      },
      body: undefined,
    });
  });

  it("loads the dashboard summary with the same headers", async () => {
    const summary = {
      counts: {
        unassigned: 1,
        assigned: 0,
        in_progress: 0,
        waiting_for_review: 0,
        in_review: 0,
        approved: 0,
      },
      overdue: 1,
      dueSoon: 0,
      avgDaysToApproval: null,
    };
    const fetchMock = vi.fn(async () => jsonResponse(summary));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAnalysisSummary(engineerId)).resolves.toEqual(summary);
    expect(fetchMock).toHaveBeenCalledWith("/api/analyses/summary", {
      method: "GET",
      headers: {
        [ORG_ID_HEADER]: DEMO_ORGANIZATION_ID,
        [ENGINEER_ID_HEADER]: engineerId,
      },
      body: undefined,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { error: { code: "unauthenticated", message: "missing" } },
          401,
        ),
      ),
    );
    await expect(fetchAnalysisSummary(engineerId)).rejects.toMatchObject({
      status: 401,
      message: "Sign in as an engineer.",
    });
  });

  it("posts a transition body and reads the analysis result", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toEqual({ action: "send_back" });
      return jsonResponse({ ...analysis, status: "in_progress" });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      transitionAnalysis(analysisId, engineerId, { action: "send_back" }),
    ).resolves.toMatchObject({ status: "in_progress" });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/analyses/${analysisId}/transitions`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("uses a short message for 401, 403, 404, 409, and 422", async () => {
    expect(analysisStatusMessage(401)).toBe("Sign in as an engineer.");
    expect(analysisStatusMessage(403)).toBe("That action is not allowed.");
    expect(analysisStatusMessage(404)).toBe("That analysis was not found.");
    expect(analysisStatusMessage(409)).toBe(
      "That action is not allowed from this status.",
    );
    expect(analysisStatusMessage(422)).toBe(
      "That assignee cannot take the analysis.",
    );

    for (const status of [401, 403, 404, 409, 422]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          jsonResponse(
            { error: { code: "unauthenticated", message: "nope" } },
            status,
          ),
        ),
      );
      await expect(listBoardAnalyses(engineerId)).rejects.toEqual(
        expect.objectContaining({
          status,
          message: analysisStatusMessage(status),
        }),
      );
    }
  });

  it("uses the shared organization error when x-org-id is missing or unknown", async () => {
    for (const body of [
      {
        error: {
          code: "invalid_org_id",
          message: "x-org-id must be the organization UUID.",
          details: [{ path: "x-org-id", message: "Invalid organization id" }],
        },
      },
      {
        error: {
          code: "unknown_organization",
          message: "No organization exists with that id.",
        },
      },
    ]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse(body, 400)),
      );
      await expect(listBoardAnalyses(engineerId)).rejects.toMatchObject({
        status: 400,
        message: "Organization error.",
      });
    }
  });

  it("does not call fetch while demo data is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(listBoardAnalyses(engineerId)).rejects.toBeInstanceOf(
      BoardApiError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

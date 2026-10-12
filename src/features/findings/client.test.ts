import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_ORGANIZATION_ID, ORG_ID_HEADER } from "@/config/org";

import { MAX_FINDING_PHOTOS } from "@/config/findings";

import { createFinding, FindingRequestError } from "./client";
import type { FindingDraft } from "./validate";

const draft: FindingDraft = {
  assetId: "10000000-0000-4000-8000-000000000022",
  description: "The support is cracked beside the access hatch.",
  severity: "high",
  zone: "bay 2",
  locationLabel: "",
  photos: [{ name: "crack.jpg", type: "image/jpeg", size: 40 }],
};

const created = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  code: "ISS-2041",
  stage: "discovered",
  severity: "high",
  createdAt: "2026-10-12T20:00:00.000Z",
  photos: [
    {
      id: "550e8400-e29b-41d4-a716-446655440011",
      issueId: "550e8400-e29b-41d4-a716-446655440010",
      storageKey:
        "10000000-0000-4000-8000-000000000001/issues/550e8400-e29b-41d4-a716-446655440010/550e8400-e29b-41d4-a716-446655440011",
      mimeType: "image/jpeg",
      caption: null,
      uploadedBy: null,
      createdAt: "2026-10-12T20:00:00.000Z",
      updatedAt: "2026-10-12T20:00:00.000Z",
    },
  ],
};

const photo = () => new File(["jpeg"], "crack.jpg", { type: "image/jpeg" });

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

describe("createFinding", () => {
  it("posts multipart photos and the organization when the route answers 201", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ [ORG_ID_HEADER]: DEMO_ORGANIZATION_ID });
      expect(init.body).toBeInstanceOf(FormData);
      const body = init.body as FormData;
      expect(body.get("assetId")).toBe(draft.assetId);
      expect(body.get("description")).toBe(draft.description);
      expect(body.get("severity")).toBe("high");
      expect(body.get("zone")).toBe("bay 2");
      expect(body.get("locationLabel")).toBeNull();
      expect(body.get("title")).toBeNull();
      expect(body.get("notes")).toBeNull();
      expect(body.get("location")).toBeNull();
      expect(body.get("reportedBy")).toBeNull();
      expect(body.get("discoveredAt")).toBeNull();
      expect(body.get("code")).toBeNull();
      expect(body.get("groupId")).toBeNull();
      expect(body.get("assetGroup")).toBeNull();
      expect(body.get("assetGroupId")).toBeNull();
      const photos = body.getAll("photos");
      expect(photos).toHaveLength(1);
      expect(photos[0]).toBeInstanceOf(File);
      return jsonResponse(created, 201);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(createFinding(draft, [photo()])).resolves.toEqual(created);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/findings",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it.each([
    ["invalid_org_id", 400, "raw", "Organization error."],
    ["unknown_organization", 400, "raw", "Organization error."],
    ["validation_error", 400, "raw", "Validation error."],
    ["payload_too_large", 413, "raw", "Photo too large."],
    ["unsupported_media_type", 415, "raw", "Photo type not supported."],
    ["asset_not_found", 404, "raw", "Asset error."],
    ["too_many_photos", 400, "raw", `Add up to ${MAX_FINDING_PHOTOS} photos.`],
  ] as const)(
    "maps %s to a readable message",
    async (code, status, serverText, message) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          jsonResponse({ error: { code, message: serverText } }, status),
        ),
      );

      await expect(createFinding(draft, [photo()])).rejects.toMatchObject({
        name: "FindingRequestError",
        kind: "http",
        status,
        code,
        message,
      });
    },
  );

  it("maps an asset problem on a 400 to an asset error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "validation_error",
              message: "Request validation failed.",
              details: [{ path: "assetId", message: "Unknown asset" }],
            },
          },
          400,
        ),
      ),
    );

    await expect(createFinding(draft, [photo()])).rejects.toMatchObject({
      kind: "http",
      status: 400,
      message: "Asset error.",
    });
  });

  it.each([
    [400, "Validation error."],
    [413, "Photo too large."],
    [415, "Photo type not supported."],
  ] as const)("maps HTTP %s with no error schema", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status })),
    );

    await expect(createFinding(draft, [photo()])).rejects.toMatchObject({
      kind: "http",
      status,
      code: null,
      message,
    });
  });

  it("rejects a network failure and a body that is not the 201 schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(createFinding(draft, [photo()])).rejects.toMatchObject({
      kind: "network",
      message: "Could not reach findings.",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ id: "nope" }, 201)),
    );
    await expect(createFinding(draft, [photo()])).rejects.toBeInstanceOf(
      FindingRequestError,
    );
    await expect(createFinding(draft, [photo()])).rejects.toMatchObject({
      kind: "parse",
      message: "Findings returned an unexpected response.",
    });
  });

  it("returns a fake 201 and does not call fetch when demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    const fetchMock = vi.fn(async () => jsonResponse(created, 201));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createFinding(draft, [photo()]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.code).toBe("ISS-DEMO");
    expect(result.stage).toBe("discovered");
    expect(result.severity).toBe("high");
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0]?.mimeType).toBe("image/jpeg");
    expect(result.photos[0]?.issueId).toBe(result.id);
    expect(result.photos[0]?.caption).toBeNull();
  });

  it("refuses an unsupported photo in both modes without calling fetch", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(created, 201));
    vi.stubGlobal("fetch", fetchMock);
    const bad = {
      ...draft,
      photos: [{ name: "notes.pdf", type: "application/pdf", size: 12 }],
    };
    const file = new File(["x"], "notes.pdf", { type: "application/pdf" });

    await expect(createFinding(bad, [file])).rejects.toThrow(
      "Photo type not supported.",
    );
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    await expect(createFinding(bad, [file])).rejects.toThrow(
      "Photo type not supported.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

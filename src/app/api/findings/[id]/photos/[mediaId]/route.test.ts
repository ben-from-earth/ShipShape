import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiErrorSchema } from "@/schemas";
import { DocumentRequestError } from "@/server/documents/errors";
import { assertOrganizationExists } from "@/server/documents/org";
import {
  FINDING_PHOTO_NOT_FOUND_MESSAGE,
  FindingPhotoNotFoundError,
  openFindingPhoto,
} from "@/server/findings/photo";

import { GET } from "./route";

vi.mock("@/server/findings/photo", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/findings/photo")
  >("@/server/findings/photo");
  return {
    ...actual,
    openFindingPhoto: vi.fn(),
  };
});

vi.mock("@/server/documents/org", () => ({
  assertOrganizationExists: vi.fn(async () => undefined),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const findingId = "550e8400-e29b-41d4-a716-446655440031";
const mediaId = "550e8400-e29b-41d4-a716-446655440032";
const bytes = new Uint8Array([9, 8, 7]);

const open = vi.mocked(openFindingPhoto);
const organizationExists = vi.mocked(assertOrganizationExists);

beforeEach(() => {
  open.mockReset();
  organizationExists.mockReset();
  organizationExists.mockResolvedValue(undefined);
  open.mockResolvedValue({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    mediaType: "image/jpeg",
  });
});

function photoRequest(init?: {
  orgId?: string | null;
  id?: string;
  mediaId?: string;
}) {
  const headers = new Headers();
  if (init?.orgId !== null) {
    headers.set("x-org-id", init?.orgId ?? orgId);
  }
  return new Request(
    `http://localhost/api/findings/${init?.id ?? findingId}/photos/${init?.mediaId ?? mediaId}`,
    { headers },
  );
}

function call(request: Request, ids: { id?: string; mediaId?: string } = {}) {
  return GET(request, {
    params: Promise.resolve({
      id: ids.id ?? findingId,
      mediaId: ids.mediaId ?? mediaId,
    }),
  });
}

describe("GET /api/findings/[id]/photos/[mediaId]", () => {
  it("streams the photo with private nosniff headers", async () => {
    const response = await call(photoRequest());
    const body = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("private");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toEqual(bytes);
    expect(organizationExists).toHaveBeenCalledWith(orgId);
    expect(open).toHaveBeenCalledWith({
      orgId,
      findingId,
      mediaId,
    });
  });

  it("returns the same 404 for the wrong organization and a mismatched photo", async () => {
    open.mockRejectedValue(new FindingPhotoNotFoundError());
    const wrongOrg = await call(photoRequest());
    open.mockRejectedValue(new FindingPhotoNotFoundError());
    const mismatched = await call(photoRequest());

    const wrongBody = apiErrorSchema.parse(await wrongOrg.json());
    const mismatchedBody = apiErrorSchema.parse(await mismatched.json());

    expect(wrongOrg.status).toBe(404);
    expect(mismatched.status).toBe(404);
    expect(wrongBody).toEqual(mismatchedBody);
    expect(wrongBody.error).toEqual({
      code: "not_found",
      message: FINDING_PHOTO_NOT_FOUND_MESSAGE,
    });
    expect(JSON.stringify(wrongBody)).not.toContain(orgId);
  });

  it("keeps organization header failures on the shared error codes", async () => {
    const missingOrg = await call(photoRequest({ orgId: null }));
    organizationExists.mockRejectedValueOnce(
      new DocumentRequestError(
        "unknown_organization",
        "No organization exists with that id.",
      ),
    );
    const unknownOrg = await call(photoRequest());

    expect(missingOrg.status).toBe(400);
    expect(apiErrorSchema.parse(await missingOrg.json()).error.code).toBe(
      "invalid_org_id",
    );
    expect(unknownOrg.status).toBe(400);
    expect(apiErrorSchema.parse(await unknownOrg.json()).error.code).toBe(
      "unknown_organization",
    );
    expect(open).not.toHaveBeenCalled();
  });
});

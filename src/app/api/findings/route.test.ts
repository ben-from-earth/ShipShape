import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiErrorSchema, createFindingResultSchema } from "@/schemas";
import { DocumentRequestError } from "@/server/documents/errors";
import { assertOrganizationExists } from "@/server/documents/org";
import { createFinding } from "@/server/findings/create";
import { FindingRequestError } from "@/server/findings/errors";
import { INTERNAL_ERROR_MESSAGE } from "@/server/http/api";

import { MAX_FINDING_UPLOAD_BYTES, POST } from "./route";

vi.mock("@/server/findings/create", () => ({
  createFinding: vi.fn(),
}));

vi.mock("@/server/documents/org", () => ({
  assertOrganizationExists: vi.fn(async () => undefined),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const assetId = "550e8400-e29b-41d4-a716-446655440022";
const findingId = "550e8400-e29b-41d4-a716-446655440031";
const photoId = "550e8400-e29b-41d4-a716-446655440032";
const storedAt = "2026-10-12T20:15:00.000Z";

const created = {
  id: findingId,
  code: "ISS-1002",
  stage: "discovered" as const,
  severity: "high" as const,
  createdAt: storedAt,
  photos: [
    {
      id: photoId,
      issueId: findingId,
      storageKey: `${orgId}/issues/${findingId}/${photoId}`,
      mimeType: "image/jpeg" as const,
      caption: null,
      uploadedBy: null,
      createdAt: storedAt,
      updatedAt: storedAt,
    },
  ],
};

const create = vi.mocked(createFinding);
const organizationExists = vi.mocked(assertOrganizationExists);

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue(created);
  organizationExists.mockReset();
  organizationExists.mockResolvedValue(undefined);
});

function findingRequest(init?: {
  fields?: Record<string, string>;
  photos?: File[];
  orgId?: string | null;
  contentLength?: string;
  contentType?: string;
}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(init?.fields ?? {})) {
    form.set(key, value);
  }
  for (const photo of init?.photos ?? []) {
    form.append("photos", photo);
  }

  const headers = new Headers();
  if (init?.orgId !== null) {
    headers.set("x-org-id", init?.orgId ?? orgId);
  }
  if (init?.contentLength !== undefined) {
    headers.set("content-length", init.contentLength);
  }
  if (init?.contentType !== undefined) {
    headers.set("content-type", init.contentType);
  }

  return new Request("http://localhost/api/findings", {
    method: "POST",
    headers,
    body: init?.contentType ? "not-a-form" : form,
  });
}

const jpeg = () =>
  new File([new Uint8Array([1, 2, 3])], "bay.jpg", { type: "image/jpeg" });

describe("POST /api/findings", () => {
  it("returns the created finding", async () => {
    const response = await POST(
      findingRequest({
        fields: {
          assetId,
          description: "The cover is cracked along the fastener line.",
          severity: "high",
        },
        photos: [jpeg()],
      }),
    );
    const body = createFindingResultSchema.parse(await response.json());

    expect(response.status).toBe(201);
    expect(body).toEqual(created);
    expect(organizationExists).toHaveBeenCalledWith(orgId);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        fields: expect.objectContaining({
          assetId,
          severity: "high",
        }),
        photos: [
          expect.objectContaining({
            fileName: "bay.jpg",
            mediaType: "image/jpeg",
          }),
        ],
      }),
    );
  });

  it("returns 400 when the organization id is missing or the body is not multipart", async () => {
    const missingOrg = await POST(
      findingRequest({
        fields: { assetId, description: "Cracked cover.", severity: "high" },
        photos: [jpeg()],
        orgId: null,
      }),
    );
    const notMultipart = await POST(
      findingRequest({
        contentType: "application/json",
        orgId,
      }),
    );

    expect(missingOrg.status).toBe(400);
    expect(apiErrorSchema.parse(await missingOrg.json()).error.code).toBe(
      "invalid_org_id",
    );
    expect(notMultipart.status).toBe(400);
    expect(apiErrorSchema.parse(await notMultipart.json()).error.code).toBe(
      "validation_error",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 400 when the organization UUID is not stored", async () => {
    organizationExists.mockRejectedValueOnce(
      new DocumentRequestError(
        "unknown_organization",
        "No organization exists with that id.",
      ),
    );

    const response = await POST(
      findingRequest({
        fields: { assetId, description: "Cracked cover.", severity: "high" },
        photos: [jpeg()],
      }),
    );

    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe(
      "unknown_organization",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 413 before reading an oversized body", async () => {
    let reads = 0;
    const stream = new ReadableStream({
      pull(controller) {
        reads += 1;
        controller.enqueue(new Uint8Array([1]));
      },
    });
    const request = new Request("http://localhost/api/findings", {
      method: "POST",
      headers: {
        "x-org-id": orgId,
        "content-type": "multipart/form-data; boundary=test",
        "content-length": String(MAX_FINDING_UPLOAD_BYTES + 1),
      },
      body: stream,
      duplex: "half",
    } as RequestInit);
    await Promise.resolve();
    const readsBefore = reads;
    const response = await POST(request);
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(413);
    expect(body.error.code).toBe("payload_too_large");
    expect(reads).toBe(readsBefore);
    expect(create).not.toHaveBeenCalled();
  });

  it("maps finding failures and hides internal errors", async () => {
    create.mockRejectedValueOnce(
      new FindingRequestError(
        "asset_not_found",
        "No asset with that id belongs to this organization.",
      ),
    );
    const missingAsset = await POST(
      findingRequest({
        fields: { assetId, description: "Cracked cover.", severity: "high" },
        photos: [jpeg()],
      }),
    );
    expect(missingAsset.status).toBe(404);
    expect(apiErrorSchema.parse(await missingAsset.json()).error.code).toBe(
      "asset_not_found",
    );

    create.mockRejectedValueOnce(
      new FindingRequestError(
        "too_many_photos",
        "A finding accepts at most 10 photos.",
      ),
    );
    const tooMany = await POST(
      findingRequest({
        fields: { assetId, description: "Cracked cover.", severity: "high" },
        photos: [jpeg()],
      }),
    );
    expect(tooMany.status).toBe(400);
    expect(apiErrorSchema.parse(await tooMany.json()).error.code).toBe(
      "too_many_photos",
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValueOnce(new Error("secret-db-host"));
    const failed = await POST(
      findingRequest({
        fields: { assetId, description: "Cracked cover.", severity: "high" },
        photos: [jpeg()],
      }),
    );
    const failedBody = apiErrorSchema.parse(await failed.json());
    expect(failed.status).toBe(500);
    expect(failedBody.error).toEqual({
      code: "internal_error",
      message: INTERNAL_ERROR_MESSAGE,
    });
    expect(JSON.stringify(failedBody)).not.toContain("secret-db-host");
    errorSpy.mockRestore();
  });
});

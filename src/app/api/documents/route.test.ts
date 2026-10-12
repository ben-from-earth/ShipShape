import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiErrorSchema, documentUploadResultSchema } from "@/schemas";
import { DocumentRequestError } from "@/server/documents/errors";
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  MULTIPART_OVERHEAD_BYTES,
} from "@/server/documents/file";
import { ingestDocument } from "@/server/documents/ingest";
import { assertOrganizationExists } from "@/server/documents/org";
import { INTERNAL_ERROR_MESSAGE } from "@/server/http/api";

import { POST } from "./route";

vi.mock("@/server/documents/ingest", () => ({
  ingestDocument: vi.fn(),
}));

vi.mock("@/server/documents/org", () => ({
  assertOrganizationExists: vi.fn(async () => undefined),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const ingest = vi.mocked(ingestDocument);
const organizationExists = vi.mocked(assertOrganizationExists);

const uploaded = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  orgId,
  title: "Hull notes",
  mediaType: "text/plain",
  storageKey: `${orgId}/550e8400-e29b-41d4-a716-446655440010`,
  status: "indexed" as const,
  chunkCount: 1,
};

beforeEach(() => {
  ingest.mockReset();
  ingest.mockResolvedValue(uploaded);
  organizationExists.mockReset();
  organizationExists.mockResolvedValue(undefined);
});

function uploadRequest(init?: {
  file?: File | string;
  title?: string;
  orgId?: string | null;
  contentLength?: string;
  contentType?: string;
}) {
  const form = new FormData();
  if (init?.file !== undefined) {
    form.set("file", init.file);
  }
  if (init?.title !== undefined) {
    form.set("title", init.title);
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

  return new Request("http://localhost/api/documents", {
    method: "POST",
    headers,
    body: init?.contentType ? "not-a-form" : form,
  });
}

describe("POST /api/documents", () => {
  it("returns the indexed document", async () => {
    const response = await POST(
      uploadRequest({
        file: new File(["Bent support"], "notes.txt", { type: "text/plain" }),
        title: "Hull notes",
      }),
    );
    const body = documentUploadResultSchema.parse(await response.json());

    expect(response.status).toBe(201);
    expect(body).toEqual(uploaded);
    expect(organizationExists).toHaveBeenCalledWith(orgId);
    expect(ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        fileName: "notes.txt",
        mediaType: "text/plain",
        title: "Hull notes",
      }),
    );
  });

  it("returns 400 when the file is missing or the organization id is invalid", async () => {
    const missingFile = await POST(uploadRequest());
    const missingOrg = await POST(
      uploadRequest({
        file: new File(["x"], "notes.txt", { type: "text/plain" }),
        orgId: null,
      }),
    );
    const malformedOrg = await POST(
      uploadRequest({
        file: new File(["x"], "notes.txt", { type: "text/plain" }),
        orgId: "not-a-uuid",
      }),
    );

    expect(missingFile.status).toBe(400);
    expect(apiErrorSchema.parse(await missingFile.json()).error.code).toBe(
      "validation_error",
    );
    expect(missingOrg.status).toBe(400);
    expect(apiErrorSchema.parse(await missingOrg.json()).error.code).toBe(
      "invalid_org_id",
    );
    expect(malformedOrg.status).toBe(400);
    expect(apiErrorSchema.parse(await malformedOrg.json()).error.code).toBe(
      "invalid_org_id",
    );
    expect(ingest).not.toHaveBeenCalled();
    expect(organizationExists).toHaveBeenCalledTimes(1);
    expect(organizationExists).toHaveBeenCalledWith(orgId);
  });

  it("returns 400 when the organization UUID is not stored", async () => {
    organizationExists.mockRejectedValueOnce(
      new DocumentRequestError(
        "unknown_organization",
        "No organization exists with that id.",
        [
          {
            path: "x-org-id",
            message: "No organization exists with that id.",
          },
        ],
      ),
    );

    const response = await POST(
      uploadRequest({
        file: new File(["x"], "notes.txt", { type: "text/plain" }),
      }),
    );
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("unknown_organization");
    expect(body.error.details?.[0]?.path).toBe("x-org-id");
    expect(ingest).not.toHaveBeenCalled();
  });

  it("returns 413 before reading an oversized body", async () => {
    const response = await POST(
      uploadRequest({
        contentType: "multipart/form-data; boundary=test",
        contentLength: String(
          MAX_DOCUMENT_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES + 1,
        ),
      }),
    );
    const body = apiErrorSchema.parse(await response.json());

    expect(response.status).toBe(413);
    expect(body.error.code).toBe("payload_too_large");
    expect(ingest).not.toHaveBeenCalled();
  });

  it("maps an unsupported file to 415 and hides internal errors", async () => {
    ingest.mockRejectedValueOnce(
      new DocumentRequestError(
        "unsupported_media_type",
        "This file type is not supported.",
      ),
    );
    const unsupported = await POST(
      uploadRequest({
        file: new File(["x"], "notes.txt", { type: "text/plain" }),
      }),
    );
    expect(unsupported.status).toBe(415);
    expect(apiErrorSchema.parse(await unsupported.json()).error).toEqual({
      code: "unsupported_media_type",
      message: "This file type is not supported.",
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    ingest.mockRejectedValueOnce(new Error("secret-db-host"));
    const failed = await POST(
      uploadRequest({
        file: new File(["x"], "notes.txt", { type: "text/plain" }),
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

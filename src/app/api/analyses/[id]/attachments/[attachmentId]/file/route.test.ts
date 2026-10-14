import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAnalysis, getAttachment } from "@/db/engineering";
import { getTenantDb } from "@/db/tenant-db";
import { apiErrorSchema } from "@/schemas";
import { getAttachmentFile } from "@/storage";

import { GET } from "./route";

vi.mock("@/db/tenant-db", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("@/db/engineering", () => ({
  getAnalysis: vi.fn(),
  getAttachment: vi.fn(),
}));

vi.mock("@/storage", () => ({
  getAttachmentFile: vi.fn(),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const engineerId = "550e8400-e29b-41d4-a716-446655440011";
const analysisId = "550e8400-e29b-41d4-a716-446655440071";
const attachmentId = "550e8400-e29b-41d4-a716-446655440091";
const storageKey = "attachments/550e8400-e29b-41d4-a716-446655440082/notes.txt";
const createdAt = "2026-10-13T12:00:00.000Z";
const bytes = Buffer.from("hello");

const execute = vi.fn();
const db = { execute };
const tenantDb = vi.mocked(getTenantDb);
const analysis = vi.mocked(getAnalysis);
const attachment = vi.mocked(getAttachment);
const file = vi.mocked(getAttachmentFile);

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue([
    {
      id: engineerId,
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "reviewer",
      createdAt,
    },
  ]);
  tenantDb.mockReset();
  tenantDb.mockResolvedValue(db as never);
  analysis.mockReset();
  analysis.mockResolvedValue({
    id: analysisId,
    code: "AN-1002",
    title: "Check the joint",
    status: "unassigned",
    assigneeId: null,
    dueDate: null,
    createdAt,
    updatedAt: createdAt,
    approvedAt: null,
    createdBy: engineerId,
  });
  attachment.mockReset();
  attachment.mockResolvedValue({
    id: attachmentId,
    analysisId,
    storageKey,
    fileName: "notes.txt",
    contentType: "text/plain",
    size: bytes.length,
    uploadedBy: engineerId,
    createdAt,
  });
  file.mockReset();
  file.mockResolvedValue({
    body: bytes,
    contentType: "text/plain",
    size: bytes.length,
  });
});

function call(init?: { attachmentId?: string }) {
  return GET(
    new Request(
      `http://localhost/api/analyses/${analysisId}/attachments/${init?.attachmentId ?? attachmentId}/file`,
      {
        headers: {
          "x-org-id": orgId,
          "x-engineer-id": engineerId,
        },
      },
    ),
    {
      params: Promise.resolve({
        id: analysisId,
        attachmentId: init?.attachmentId ?? attachmentId,
      }),
    },
  );
}

describe("GET /api/analyses/[id]/attachments/[attachmentId]/file", () => {
  it("streams the stored file", async () => {
    const response = await call();
    const body = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain");
    expect(response.headers.get("cache-control")).toBe("private");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toEqual(bytes);
    expect(file).toHaveBeenCalledWith(orgId, storageKey);
  });

  it("returns 404 when the attachment has no storage key", async () => {
    attachment.mockResolvedValueOnce({
      id: attachmentId,
      analysisId,
      documentId: "550e8400-e29b-41d4-a716-446655440010",
      uploadedBy: engineerId,
      createdAt,
    });
    const response = await call();

    expect(response.status).toBe(404);
    expect(apiErrorSchema.parse(await response.json()).error).toMatchObject({
      code: "not_found",
      message: "That file was not found.",
    });
    expect(file).not.toHaveBeenCalled();
  });

  it("returns 404 when the attachment is missing", async () => {
    attachment.mockResolvedValueOnce(null);
    const response = await call();

    expect(response.status).toBe(404);
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe(
      "not_found",
    );
    expect(file).not.toHaveBeenCalled();
  });
});

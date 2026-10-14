import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addAttachment,
  addComment,
  createAnalysis,
  getAnalysis,
  listAnalyses,
  listAttachments,
  listComments,
  transitionAnalysis,
} from "@/db/engineering";
import { getTenantDb } from "@/db/tenant-db";
import {
  analysisAttachmentSchema,
  analysisCommentSchema,
  analysisSchema,
  apiErrorSchema,
  createAnalysisResultSchema,
} from "@/schemas";
import { ingestDocument } from "@/server/documents/ingest";

import {
  GET as getAttachment,
  POST as postAttachment,
} from "./[id]/attachments/route";
import { GET as getComments, POST as postComment } from "./[id]/comments/route";
import { GET as getOne } from "./[id]/route";
import { POST as postTransition } from "./[id]/transitions/route";
import { GET as list, POST as create } from "./route";

vi.mock("@/db/tenant-db", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("@/db/engineering", () => ({
  addAttachment: vi.fn(),
  addComment: vi.fn(),
  createAnalysis: vi.fn(),
  getAnalysis: vi.fn(),
  listAnalyses: vi.fn(),
  listAttachments: vi.fn(),
  listComments: vi.fn(),
  transitionAnalysis: vi.fn(),
}));

vi.mock("@/server/documents/ingest", () => ({
  ingestDocument: vi.fn(),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const engineerId = "550e8400-e29b-41d4-a716-446655440011";
const analysisId = "550e8400-e29b-41d4-a716-446655440071";
const assigneeId = "550e8400-e29b-41d4-a716-446655440012";
const documentId = "550e8400-e29b-41d4-a716-446655440010";
const createdAt = "2026-10-13T12:00:00.000Z";

const execute = vi.fn();
const db = { execute };
const tenantDb = vi.mocked(getTenantDb);
const createRow = vi.mocked(createAnalysis);
const listRows = vi.mocked(listAnalyses);
const getRow = vi.mocked(getAnalysis);
const transition = vi.mocked(transitionAnalysis);
const comment = vi.mocked(addComment);
const comments = vi.mocked(listComments);
const attachment = vi.mocked(addAttachment);
const attachments = vi.mocked(listAttachments);
const ingest = vi.mocked(ingestDocument);

const engineer = {
  id: engineerId,
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "reviewer",
  createdAt,
};

const analysis = {
  id: analysisId,
  code: "AN-1002",
  title: "Check the joint",
  status: "unassigned" as const,
  assigneeId: null,
  dueDate: null,
  createdAt,
  updatedAt: createdAt,
  approvedAt: null,
  createdBy: engineerId,
};

const storedComment = {
  id: "550e8400-e29b-41d4-a716-446655440081",
  analysisId,
  authorId: engineerId,
  body: "Looks sound.",
  createdAt,
};

const storedAttachment = {
  id: "550e8400-e29b-41d4-a716-446655440091",
  analysisId,
  documentId,
  uploadedBy: engineerId,
  createdAt,
};

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue([engineer]);
  tenantDb.mockReset();
  tenantDb.mockResolvedValue(db as never);
  createRow.mockReset();
  listRows.mockReset();
  getRow.mockReset();
  transition.mockReset();
  comment.mockReset();
  comments.mockReset();
  attachment.mockReset();
  attachments.mockReset();
  ingest.mockReset();
  createRow.mockResolvedValue(analysis);
  listRows.mockResolvedValue([analysis]);
  getRow.mockResolvedValue(analysis);
  transition.mockResolvedValue({ kind: "ok", analysis });
  comment.mockResolvedValue(storedComment);
  comments.mockResolvedValue([storedComment]);
  attachment.mockResolvedValue(storedAttachment);
  attachments.mockResolvedValue([storedAttachment]);
  ingest.mockResolvedValue({
    id: documentId,
    orgId,
    title: "notes.txt",
    mediaType: "text/plain",
    storageKey: `${orgId}/${documentId}`,
    status: "indexed",
    chunkCount: 1,
  });
});

function jsonRequest(
  url: string,
  body: unknown,
  init?: { engineerId?: string | null; orgId?: string | null },
) {
  return new Request(url, {
    method: "POST",
    headers: headers(init, "application/json"),
    body: JSON.stringify(body),
  });
}

function headers(
  init?: { engineerId?: string | null; orgId?: string | null },
  contentType?: string,
) {
  const result = new Headers();
  if (init?.orgId !== null) {
    result.set("x-org-id", init?.orgId ?? orgId);
  }
  if (init?.engineerId !== null) {
    result.set("x-engineer-id", init?.engineerId ?? engineerId);
  }
  if (contentType) {
    result.set("content-type", contentType);
  }
  return result;
}

describe("analyses API", () => {
  it("creates an analysis for the engineer", async () => {
    const response = await create(
      jsonRequest("http://localhost/api/analyses", {
        title: "Check the joint",
        dueDate: "2026-10-20",
      }),
    );

    expect(response.status).toBe(201);
    expect(createAnalysisResultSchema.parse(await response.json())).toEqual(
      analysis,
    );
    expect(tenantDb).toHaveBeenCalledWith(orgId);
    expect(createRow).toHaveBeenCalledWith(db, {
      title: "Check the joint",
      dueDate: "2026-10-20",
      createdBy: engineerId,
    });
  });

  it("rejects an unknown create key with path body", async () => {
    const response = await create(
      jsonRequest("http://localhost/api/analyses", {
        title: "Check the joint",
        repairId: analysisId,
      }),
    );

    expect(response.status).toBe(400);
    expect(apiErrorSchema.parse(await response.json()).error).toMatchObject({
      code: "validation_error",
      details: [{ path: "body" }],
    });
    expect(createRow).not.toHaveBeenCalled();
  });

  it("lists analyses", async () => {
    const response = await list(
      new Request("http://localhost/api/analyses", { headers: headers() }),
    );

    expect(response.status).toBe(200);
    expect(analysisSchema.array().parse(await response.json())).toEqual([
      analysis,
    ]);
    expect(listRows).toHaveBeenCalledWith(db);
  });

  it("returns one analysis and 404 when it is missing", async () => {
    const found = await getOne(
      new Request(`http://localhost/api/analyses/${analysisId}`, {
        headers: headers(),
      }),
      { params: Promise.resolve({ id: analysisId }) },
    );
    getRow.mockResolvedValueOnce(null);
    const missing = await getOne(
      new Request(`http://localhost/api/analyses/${analysisId}`, {
        headers: headers(),
      }),
      { params: Promise.resolve({ id: analysisId }) },
    );

    expect(found.status).toBe(200);
    expect(analysisSchema.parse(await found.json())).toEqual(analysis);
    expect(missing.status).toBe(404);
    expect(apiErrorSchema.parse(await missing.json()).error.code).toBe(
      "not_found",
    );
  });

  it("maps transition results and rejects an unknown key", async () => {
    const ok = await postTransition(
      jsonRequest(`http://localhost/api/analyses/${analysisId}/transitions`, {
        action: "assign",
        assigneeId,
      }),
      { params: Promise.resolve({ id: analysisId }) },
    );
    expect(ok.status).toBe(200);
    expect(transition).toHaveBeenCalledWith({
      db,
      analysisId,
      actorId: engineerId,
      action: "assign",
      assigneeId,
    });

    const cases = [
      ["not_found", 404],
      ["forbidden", 403],
      ["invalid_state", 409],
      ["invalid_assignee", 422],
    ] as const;
    for (const [kind, status] of cases) {
      transition.mockResolvedValueOnce(
        kind === "invalid_state" ? { kind, status: "approved" } : { kind },
      );
      const response = await postTransition(
        jsonRequest(`http://localhost/api/analyses/${analysisId}/transitions`, {
          action: "start",
        }),
        { params: Promise.resolve({ id: analysisId }) },
      );
      expect(response.status).toBe(status);
      expect(apiErrorSchema.parse(await response.json()).error.code).toBe(kind);
    }

    const unknown = await postTransition(
      jsonRequest(`http://localhost/api/analyses/${analysisId}/transitions`, {
        action: "start",
        note: "extra",
      }),
      { params: Promise.resolve({ id: analysisId }) },
    );
    expect(unknown.status).toBe(400);
    expect(apiErrorSchema.parse(await unknown.json()).error).toMatchObject({
      code: "validation_error",
      details: [{ path: "body" }],
    });
  });

  it("creates and lists comments", async () => {
    const created = await postComment(
      jsonRequest(`http://localhost/api/analyses/${analysisId}/comments`, {
        body: "Looks sound.",
      }),
      { params: Promise.resolve({ id: analysisId }) },
    );
    comment.mockResolvedValueOnce(null);
    const missing = await postComment(
      jsonRequest(`http://localhost/api/analyses/${analysisId}/comments`, {
        body: "Looks sound.",
      }),
      { params: Promise.resolve({ id: analysisId }) },
    );
    const unknown = await postComment(
      jsonRequest(`http://localhost/api/analyses/${analysisId}/comments`, {
        body: "Looks sound.",
        analysisId,
      }),
      { params: Promise.resolve({ id: analysisId }) },
    );
    const listed = await getComments(
      new Request(`http://localhost/api/analyses/${analysisId}/comments`, {
        headers: headers(),
      }),
      { params: Promise.resolve({ id: analysisId }) },
    );

    expect(created.status).toBe(201);
    expect(analysisCommentSchema.parse(await created.json())).toEqual(
      storedComment,
    );
    expect(comment).toHaveBeenCalledWith(db, {
      analysisId,
      authorId: engineerId,
      body: "Looks sound.",
    });
    expect(missing.status).toBe(404);
    expect(unknown.status).toBe(400);
    expect(apiErrorSchema.parse(await unknown.json()).error).toMatchObject({
      code: "validation_error",
      details: [{ path: "body" }],
    });
    expect(listed.status).toBe(200);
    expect(analysisCommentSchema.array().parse(await listed.json())).toEqual([
      storedComment,
    ]);
  });

  it("uploads a document and lists attachments", async () => {
    function upload() {
      const form = new FormData();
      form.set(
        "file",
        new File(["hello"], "notes.txt", { type: "text/plain" }),
      );
      return new Request(
        `http://localhost/api/analyses/${analysisId}/attachments`,
        { method: "POST", headers: headers(), body: form },
      );
    }

    const created = await postAttachment(upload(), {
      params: Promise.resolve({ id: analysisId }),
    });
    getRow.mockResolvedValueOnce(null);
    const missing = await postAttachment(upload(), {
      params: Promise.resolve({ id: analysisId }),
    });
    const listed = await getAttachment(
      new Request(`http://localhost/api/analyses/${analysisId}/attachments`, {
        headers: headers(),
      }),
      { params: Promise.resolve({ id: analysisId }) },
    );

    expect(created.status).toBe(201);
    expect(analysisAttachmentSchema.parse(await created.json())).toEqual(
      storedAttachment,
    );
    expect(ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId,
        fileName: "notes.txt",
        mediaType: "text/plain",
      }),
    );
    expect(attachment).toHaveBeenCalledWith(db, {
      analysisId,
      documentId,
      uploadedBy: engineerId,
    });
    expect(missing.status).toBe(404);
    expect(listed.status).toBe(200);
    expect(analysisAttachmentSchema.array().parse(await listed.json())).toEqual(
      [storedAttachment],
    );
  });

  it("returns 401 when the engineer header is missing", async () => {
    const response = await create(
      jsonRequest(
        "http://localhost/api/analyses",
        { title: "Check the joint" },
        { engineerId: null },
      ),
    );

    expect(response.status).toBe(401);
    expect(apiErrorSchema.parse(await response.json()).error.code).toBe(
      "unauthenticated",
    );
    expect(createRow).not.toHaveBeenCalled();
  });
});

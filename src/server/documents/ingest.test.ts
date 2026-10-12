import { describe, expect, it, vi } from "vitest";

import { DOCUMENT_EMBEDDING_DIMENSIONS } from "@/schemas";
import type { ObjectStorage } from "@/server/storage";

import { DocumentRequestError } from "./errors";
import { ingestDocument, type IngestDependencies } from "./ingest";
import type { IndexedDocumentInsert } from "./persist";

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const userId = "550e8400-e29b-41d4-a716-446655440001";

function vector(): number[] {
  return Array.from({ length: DOCUMENT_EMBEDDING_DIMENSIONS }, () => 0.1);
}

function dependencies(
  overrides: Partial<IngestDependencies> = {},
): IngestDependencies & {
  stored: IndexedDocumentInsert[];
  events: string[];
  deleted: string[];
} {
  const stored: IndexedDocumentInsert[] = [];
  const events: string[] = [];
  const deleted: string[] = [];
  const storage: ObjectStorage = {
    async put(key) {
      events.push("put");
      return { key: `disk/${key}` };
    },
    async get() {
      return null;
    },
    async read() {
      return null;
    },
    async delete(key) {
      deleted.push(key);
    },
  };

  return {
    stored,
    events,
    deleted,
    storage,
    embedTexts: vi.fn(async (texts: string[]) => {
      events.push("embed");
      return texts.map(() => vector());
    }),
    insertDocument: vi.fn(async (document: IndexedDocumentInsert) => {
      events.push("insert");
      stored.push(document);
    }),
    ...overrides,
  };
}

async function ingest(
  deps: IngestDependencies,
  overrides: {
    fileName?: string;
    mediaType?: string;
    bytes?: Uint8Array;
    title?: string;
    maxBytes?: number;
    uploadedBy?: string;
  } = {},
) {
  const bytes =
    overrides.bytes ?? new TextEncoder().encode("Bent support near the hatch.");
  return ingestDocument(
    {
      orgId,
      fileName: overrides.fileName ?? "notes.txt",
      mediaType: overrides.mediaType ?? "text/plain",
      bytes,
      title: overrides.title,
      uploadedBy: overrides.uploadedBy,
      maxBytes: overrides.maxBytes,
    },
    deps,
  );
}

describe("ingestDocument", () => {
  it("embeds before writing and stores the key the adapter returns", async () => {
    const deps = dependencies();

    const result = await ingest(deps, {
      title: "Hull notes",
      uploadedBy: userId,
    });

    expect(deps.events).toEqual(["embed", "put", "insert"]);
    expect(result.status).toBe("indexed");
    expect(result.chunkCount).toBe(1);
    expect(result.storageKey.startsWith("disk/")).toBe(true);
    expect(deps.stored[0]?.storageKey).toBe(result.storageKey);
    expect(deps.stored[0]?.orgId).toBe(orgId);
    expect(deps.stored[0]?.uploadedBy).toBe(userId);
    expect(deps.stored[0]?.mimeType).toBe("text/plain");
    expect(deps.stored[0]?.chunks[0]?.embedding).toHaveLength(
      DOCUMENT_EMBEDDING_DIMENSIONS,
    );
    expect(deps.stored[0]?.chunks[0]?.text).toContain("Bent support");
  });

  it("accepts a markdown alias and stores text/markdown", async () => {
    const deps = dependencies();
    const result = await ingest(deps, {
      fileName: "notes.md",
      mediaType: "text/x-markdown",
      bytes: new TextEncoder().encode("# Hatch\n\nThe plate is cracked."),
    });

    expect(result.mediaType).toBe("text/markdown");
  });

  it("does not store anything when the file is the wrong type or too large", async () => {
    const wrongType = dependencies();
    await expect(
      ingest(wrongType, {
        fileName: "notes.txt",
        mediaType: "application/pdf",
      }),
    ).rejects.toMatchObject({
      code: "unsupported_media_type",
      status: 415,
    });

    const tooLarge = dependencies();
    await expect(
      ingest(tooLarge, {
        bytes: new Uint8Array(8),
        maxBytes: 4,
      }),
    ).rejects.toMatchObject({ code: "payload_too_large", status: 413 });

    const emptyType = dependencies();
    await expect(ingest(emptyType, { mediaType: "" })).rejects.toMatchObject({
      code: "validation_error",
      status: 400,
    });

    expect(wrongType.events).toEqual([]);
    expect(tooLarge.events).toEqual([]);
    expect(emptyType.events).toEqual([]);
  });

  it("does not store a file when embedding fails", async () => {
    const deps = dependencies({
      embedTexts: async () => {
        throw new Error("model failed");
      },
    });

    await expect(ingest(deps)).rejects.toThrow(/model failed/);
    expect(deps.events).toEqual([]);
    expect(deps.deleted).toEqual([]);
  });

  it("deletes the stored file when the insert fails", async () => {
    const deps = dependencies({
      insertDocument: async () => {
        throw new Error("database unavailable");
      },
    });

    await expect(ingest(deps)).rejects.toThrow(/database unavailable/);
    expect(deps.deleted).toEqual([expect.stringMatching(/^disk\//)]);
  });

  it("turns a foreign-key failure into a validation error after cleanup", async () => {
    const deps = dependencies({
      insertDocument: async () => {
        throw Object.assign(new Error("insert failed"), { code: "23503" });
      },
    });

    await expect(ingest(deps)).rejects.toBeInstanceOf(DocumentRequestError);
    await expect(ingest(deps)).rejects.toMatchObject({
      status: 400,
      code: "validation_error",
    });
    expect(deps.deleted.length).toBeGreaterThan(0);
  });

  it("reports an unreadable pdf as a validation error", async () => {
    const deps = dependencies();

    await expect(
      ingest(deps, {
        fileName: "broken.pdf",
        mediaType: "application/pdf",
        bytes: new TextEncoder().encode("%PDF-1.4 nope"),
      }),
    ).rejects.toMatchObject({
      code: "validation_error",
      message: "The file could not be read.",
    });
    expect(deps.events).toEqual([]);
  });
});

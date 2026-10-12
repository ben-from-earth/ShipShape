import { describe, expect, it } from "vitest";

import type { Database } from "@/db";
import { documentChunks, documents } from "@/db/schema";

import { insertIndexedDocument, type IndexedDocumentInsert } from "./persist";

const embedding = Array.from({ length: 384 }, () => 0);

function document(): IndexedDocumentInsert {
  return {
    id: "550e8400-e29b-41d4-a716-446655440010",
    orgId: "550e8400-e29b-41d4-a716-446655440000",
    title: "Hull notes",
    storageKey: "org/doc",
    mimeType: "text/plain",
    uploadedBy: null,
    chunks: [
      {
        index: 0,
        text: "Bent support near the access hatch.",
        startOffset: 0,
        endOffset: 36,
        pageStart: null,
        pageEnd: null,
        embedding,
      },
    ],
  };
}

describe("insertIndexedDocument", () => {
  it("writes the document and its chunks in one batch", async () => {
    const inserts: { table: unknown; value: unknown }[] = [];
    let batched: unknown[] | undefined;
    const db = {
      insert(table: unknown) {
        return {
          values(value: unknown) {
            const query = { table, value };
            inserts.push(query);
            return query;
          },
        };
      },
      async batch(queries: unknown[]) {
        batched = queries;
        return [];
      },
    } as unknown as Database;

    await insertIndexedDocument(db, document());

    expect(inserts.map((entry) => entry.table)).toEqual([
      documents,
      documentChunks,
    ]);
    expect(batched).toEqual(inserts);
    expect(batched).toHaveLength(2);
  });

  it("refuses to open a batch for a document with no chunks", async () => {
    const db = {
      insert() {
        throw new Error("insert should not run");
      },
      async batch() {
        throw new Error("batch should not run");
      },
    } as unknown as Database;

    await expect(
      insertIndexedDocument(db, { ...document(), chunks: [] }),
    ).rejects.toThrow(/no chunks/);
  });
});

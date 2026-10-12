import "server-only";

import type { Database } from "@/db";
import { documentChunks, documents } from "@/db/schema";

export type IndexedChunkInsert = {
  index: number;
  text: string;
  startOffset: number;
  endOffset: number;
  pageStart: number | null;
  pageEnd: number | null;
  embedding: number[];
};

export type IndexedDocumentInsert = {
  id: string;
  orgId: string;
  title: string;
  storageKey: string;
  mimeType: string;
  uploadedBy: string | null;
  chunks: IndexedChunkInsert[];
};

/**
 * Insert the document and its chunks together.
 * neon-http cannot open an interactive transaction. `db.batch` submits
 * both statements as one Neon transaction, so a failed chunk insert
 * rolls the document back.
 */
export async function insertIndexedDocument(
  db: Database,
  document: IndexedDocumentInsert,
): Promise<void> {
  if (document.chunks.length === 0) {
    throw new Error("Refusing to index a document with no chunks");
  }

  await db.batch([
    db.insert(documents).values({
      id: document.id,
      orgId: document.orgId,
      title: document.title,
      storageKey: document.storageKey,
      mimeType: document.mimeType,
      status: "indexed",
      uploadedBy: document.uploadedBy,
    }),
    db.insert(documentChunks).values(
      document.chunks.map((chunk) => ({
        documentId: document.id,
        index: chunk.index,
        text: chunk.text,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        pageStart: chunk.pageStart,
        pageEnd: chunk.pageEnd,
        embedding: chunk.embedding,
      })),
    ),
  ]);
}

import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { getDb } from "@/db";
import {
  documentEmbeddingSchema,
  documentUploadResultSchema,
  idSchema,
  shortTextSchema,
  type DocumentUploadResult,
} from "@/schemas";
import { createLocalDiskStorage, type ObjectStorage } from "@/server/storage";

import { chunkText } from "./chunk";
import { embed } from "./embed";
import { detailsFromZod, DocumentRequestError } from "./errors";
import { UnsupportedDocumentMediaTypeError, extractText } from "./extract";
import { assertSupportedDocument } from "./file";
import { insertIndexedDocument, type IndexedDocumentInsert } from "./persist";

export type IngestDocumentInput = {
  orgId: string;
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
  title?: string | null;
  uploadedBy?: string | null;
  maxBytes?: number;
};

export type IngestDependencies = {
  storage: ObjectStorage;
  embedTexts: (texts: string[]) => Promise<number[][]>;
  insertDocument: (document: IndexedDocumentInsert) => Promise<void>;
};

/**
 * Validate, extract, chunk, and embed a file, then store the bytes and
 * the indexed rows. Embedding runs before any write. If the database
 * insert fails, the stored file is deleted.
 */
export async function ingestDocument(
  input: IngestDocumentInput,
  dependencies: IngestDependencies = defaultDependencies(),
): Promise<DocumentUploadResult> {
  const orgId = requireId(input.orgId, "orgId", "orgId must be a UUID.");
  const uploadedBy = optionalId(input.uploadedBy);
  const { mediaType } = assertSupportedDocument({
    fileName: input.fileName,
    mediaType: input.mediaType,
    byteLength: input.bytes.byteLength,
    maxBytes: input.maxBytes,
  });
  const title = resolveTitle(input.title, input.fileName);

  let extracted;
  try {
    extracted = await extractText(input.bytes, mediaType);
  } catch (error) {
    const readError = asReadError(error);
    if (readError) {
      throw readError;
    }
    throw error;
  }

  const chunks = chunkText(extracted);
  if (chunks.length === 0) {
    throw new DocumentRequestError(
      "validation_error",
      "The document has no text to index.",
    );
  }

  const embeddings = await dependencies.embedTexts(
    chunks.map((chunk) => chunk.text),
  );
  assertEmbeddings(embeddings, chunks.length);

  const id = randomUUID();
  const requestedKey = `${orgId}/${id}`;
  const stored = await dependencies.storage.put(requestedKey, input.bytes);

  const document: IndexedDocumentInsert = {
    id,
    orgId,
    title,
    storageKey: stored.key,
    mimeType: mediaType,
    uploadedBy,
    chunks: chunks.map((chunk, index) => {
      const embedding = embeddings[index];
      if (embedding === undefined) {
        throw new Error(`Missing embedding for chunk ${chunk.index}`);
      }
      return { ...chunk, embedding };
    }),
  };

  try {
    await dependencies.insertDocument(document);
  } catch (error) {
    await dependencies.storage
      .delete(stored.key)
      .catch((cleanupError: unknown) => {
        console.error(
          "Could not remove an uploaded file after a failed insert",
          cleanupError,
        );
      });

    if (isForeignKeyViolation(error)) {
      throw new DocumentRequestError(
        "validation_error",
        "The organization or uploader was not found.",
      );
    }
    throw error;
  }

  return documentUploadResultSchema.parse({
    id,
    orgId,
    title,
    mediaType,
    storageKey: stored.key,
    status: "indexed",
    chunkCount: chunks.length,
  });
}

function defaultDependencies(): IngestDependencies {
  const db = getDb();
  return {
    storage: createLocalDiskStorage(),
    embedTexts: embed,
    insertDocument: (document) => insertIndexedDocument(db, document),
  };
}

function requireId(value: string, field: string, message: string): string {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) {
    throw new DocumentRequestError("validation_error", message, [
      {
        path: field,
        message: detailsFromZod(parsed.error)[0]?.message ?? message,
      },
    ]);
  }
  return parsed.data;
}

function optionalId(value: string | null | undefined): string | null {
  if (value === undefined || value === null || value.trim() === "") {
    return null;
  }
  return requireId(value, "uploadedBy", "uploadedBy must be a user id.");
}

function resolveTitle(
  title: string | null | undefined,
  fileName: string,
): string {
  const provided = title?.trim() ?? "";
  if (provided.length > 0) {
    const parsed = shortTextSchema.safeParse(provided);
    if (!parsed.success) {
      throw new DocumentRequestError(
        "validation_error",
        "The title must be 1 to 200 characters.",
        detailsFromZod(parsed.error).map((detail) => ({
          ...detail,
          path: detail.path || "title",
        })),
      );
    }
    return parsed.data;
  }

  const base = path.posix.basename(fileName.replaceAll("\\", "/"));
  const extension = path.posix.extname(base);
  const stem = base.slice(0, base.length - extension.length).trim();
  const fallback = (stem || "Untitled").slice(0, 200).trim() || "Untitled";
  return shortTextSchema.parse(fallback);
}

function assertEmbeddings(embeddings: number[][], count: number): void {
  if (embeddings.length !== count) {
    throw new Error(
      `Expected ${count} embeddings and received ${embeddings.length}`,
    );
  }

  for (const embedding of embeddings) {
    documentEmbeddingSchema.parse(embedding);
  }
}

function asReadError(error: unknown): DocumentRequestError | undefined {
  if (error instanceof UnsupportedDocumentMediaTypeError) {
    return new DocumentRequestError(
      "unsupported_media_type",
      "This file type is not supported. Upload a PDF, DOCX, TXT, or Markdown file.",
    );
  }

  if (!(error instanceof Error)) {
    return undefined;
  }

  const readable =
    error.message.startsWith("Could not extract") ||
    error.message.startsWith("Could not decode") ||
    error.message.startsWith("Cannot extract");
  if (!readable) {
    return undefined;
  }

  return new DocumentRequestError(
    "validation_error",
    "The file could not be read.",
  );
}

function isForeignKeyViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && current.code === "23503") {
      return true;
    }
    if (
      "message" in current &&
      typeof current.message === "string" &&
      current.message.includes("violates foreign key constraint")
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

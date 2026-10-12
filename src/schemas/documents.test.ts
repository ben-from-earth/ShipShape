import { describe, expect, it } from "vitest";

import {
  DOCUMENT_EMBEDDING_DIMENSIONS,
  documentChunkSchema,
  documentEmbeddingSchema,
  documentSearchHitSchema,
  documentSearchQuerySchema,
  documentSearchResultSchema,
} from "@/schemas";

const documentId = "550e8400-e29b-41d4-a716-446655440000";

const chunk = {
  index: 0,
  text: "Bent support near the access hatch.",
  startOffset: 0,
  endOffset: 36,
  pageStart: 1,
  pageEnd: 1,
};

const hit = {
  documentId,
  documentTitle: "Hull inspection notes",
  chunk,
  snippet: "Bent support near the access hatch.",
  score: 0.82,
};

describe("document chunk and search schemas", () => {
  it("accepts a chunk and a search result", () => {
    const parsed = documentSearchResultSchema.parse({
      query: "bent support",
      hits: [hit],
    });

    expect(parsed.hits[0]?.documentTitle).toBe(hit.documentTitle);
    expect(parsed.hits[0]?.snippet).toBe(hit.snippet);
    expect(parsed.hits[0]?.chunk.text).toBe(chunk.text);
    expect(parsed.hits[0]?.chunk.pageStart).toBe(1);
    expect(parsed.hits[0]?.chunk.pageEnd).toBe(1);
    expect(documentEmbeddingSchema.parse(new Array(384).fill(0))).toHaveLength(
      DOCUMENT_EMBEDDING_DIMENSIONS,
    );
  });

  it("accepts a search hit with a title and a snippet", () => {
    const parsed = documentSearchHitSchema.parse(hit);

    expect(parsed.documentTitle).toBe("Hull inspection notes");
    expect(parsed.snippet).toBe("Bent support near the access hatch.");
    expect(parsed.chunk.pageStart).toBe(1);
    expect(parsed.chunk.pageEnd).toBe(1);
    expect(parsed.score).toBe(0.82);
  });

  it("rejects a search hit with an empty or missing title or snippet", () => {
    expect(
      documentSearchHitSchema.safeParse({ ...hit, documentTitle: "" }).success,
    ).toBe(false);
    expect(
      documentSearchHitSchema.safeParse({ ...hit, snippet: "" }).success,
    ).toBe(false);
    expect(
      documentSearchHitSchema.safeParse({
        documentId: hit.documentId,
        chunk: hit.chunk,
        snippet: hit.snippet,
        score: hit.score,
      }).success,
    ).toBe(false);
    expect(
      documentSearchHitSchema.safeParse({
        documentId: hit.documentId,
        documentTitle: hit.documentTitle,
        chunk: hit.chunk,
        score: hit.score,
      }).success,
    ).toBe(false);
  });

  it("trims a search query and rejects an inverted chunk", () => {
    expect(
      documentSearchQuerySchema.parse({ query: "  hatch  ", limit: 5 }).query,
    ).toBe("hatch");

    expect(
      documentChunkSchema.safeParse({
        ...chunk,
        endOffset: 0,
        startOffset: 4,
      }).success,
    ).toBe(false);

    expect(
      documentChunkSchema.safeParse({
        ...chunk,
        pageStart: 2,
        pageEnd: null,
      }).success,
    ).toBe(false);

    expect(documentSearchQuerySchema.safeParse({ query: "   " }).success).toBe(
      false,
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  DOCUMENT_EMBEDDING_DIMENSIONS,
  documentChunkSchema,
  documentEmbeddingSchema,
  documentSearchQuerySchema,
  documentSearchResultSchema,
} from "@/schemas";

const chunk = {
  index: 0,
  text: "Bent support near the access hatch.",
  startOffset: 0,
  endOffset: 36,
  pageStart: 1,
  pageEnd: 1,
};

describe("document chunk and search schemas", () => {
  it("accepts a chunk and a search result", () => {
    const documentId = "550e8400-e29b-41d4-a716-446655440000";
    const parsed = documentSearchResultSchema.parse({
      query: "bent support",
      hits: [
        {
          documentId,
          chunk,
          score: 0.82,
        },
      ],
    });

    expect(parsed.hits[0]?.chunk.text).toBe(chunk.text);
    expect(documentEmbeddingSchema.parse(new Array(384).fill(0))).toHaveLength(
      DOCUMENT_EMBEDDING_DIMENSIONS,
    );
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

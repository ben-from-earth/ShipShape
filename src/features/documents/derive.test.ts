import { describe, expect, it } from "vitest";

import { documentSearchHitSchema } from "@/schemas";

import {
  documentFromFile,
  formatPageRange,
  mediaTypeForFile,
  rankDemoHits,
  scorePercent,
} from "./derive";
import { DEMO_SEARCH_HITS } from "./fixtures";

const createdAt = "2026-10-12T19:42:00.000Z";
const id = "550e8400-e29b-41d4-a716-446655440099";

describe("formatPageRange", () => {
  it("hides a range when the format has no pages", () => {
    expect(formatPageRange(null, null)).toBeNull();
  });

  it("prints one page or a span", () => {
    expect(formatPageRange(7, 7)).toBe("p. 7");
    expect(formatPageRange(11, 12)).toBe("p. 11\u201312");
  });
});

describe("rankDemoHits", () => {
  it("keeps the title and snippet and prefers the closer match", () => {
    const hits = rankDemoHits(DEMO_SEARCH_HITS, "hairline crack near a joint");

    expect(hits[0]?.documentTitle).toBe("T-45 Goshawk joint inspection");
    expect(hits[0]?.snippet).toContain("hairline crack");
    expect(
      formatPageRange(hits[0]!.chunk.pageStart, hits[0]!.chunk.pageEnd),
    ).toBe("p. 11\u201312");
    expect(
      hits.every((hit) => documentSearchHitSchema.safeParse(hit).success),
    ).toBe(true);
  });

  it("returns nothing when no passage shares a word", () => {
    expect(rankDemoHits(DEMO_SEARCH_HITS, "zzzz unmatched")).toEqual([]);
  });

  it("draws a full bar at 1 and an empty bar below 0", () => {
    expect(scorePercent(0.86)).toBe(86);
    expect(scorePercent(1)).toBe(100);
    expect(scorePercent(-0.2)).toBe(0);
  });
});

describe("documentFromFile", () => {
  it("accepts a pdf, a markdown alias, and a docx extension", () => {
    expect(mediaTypeForFile("notes.pdf", "application/pdf")).toBe(
      "application/pdf",
    );
    expect(mediaTypeForFile("notes.md", "text/x-markdown")).toBe(
      "text/markdown",
    );
    expect(mediaTypeForFile("notes.docx", "")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(mediaTypeForFile("photo.png", "image/png")).toBeNull();

    expect(
      documentFromFile(
        { name: "Hull inspection notes.pdf", type: "application/pdf" },
        { id, createdAt },
      ),
    ).toMatchObject({
      id,
      title: "Hull inspection notes",
      mediaType: "application/pdf",
      uploadedBy: "Demo",
    });
  });
});

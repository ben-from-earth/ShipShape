import { describe, expect, it } from "vitest";

import { documentChunkSchema } from "@/schemas";

import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns one chunk for a short document", () => {
    const text = "Bent support.";

    expect(chunkText(text)).toEqual([
      {
        index: 0,
        text,
        startOffset: 0,
        endOffset: text.length,
        pageStart: null,
        pageEnd: null,
      },
    ]);
  });

  it("returns nothing for empty or whitespace-only text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText(" \n\t")).toEqual([]);
    expect(chunkText({ segments: [{ page: 1, text: "  " }] })).toEqual([]);
  });

  it("normalizes newlines and splits on word boundaries with overlap", () => {
    const words = Array.from({ length: 40 }, (_, index) => `word${index}`);
    const text = words.join(" ");
    const chunks = chunkText(text, {
      maxCharacters: 36,
      overlapCharacters: 8,
    });

    expect(chunks.length).toBeGreaterThan(1);

    const covered = new Array<boolean>(text.length).fill(false);
    for (const [index, chunk] of chunks.entries()) {
      expect(chunk.index).toBe(index);
      expect(text.slice(chunk.startOffset, chunk.endOffset)).toBe(chunk.text);
      expect(chunk.text.length).toBeLessThanOrEqual(36);
      expect(chunk.text).toBe(chunk.text.trim());
      expect(chunk.text.startsWith("word")).toBe(true);
      expect(documentChunkSchema.parse(chunk)).toEqual(chunk);

      for (
        let offset = chunk.startOffset;
        offset < chunk.endOffset;
        offset += 1
      ) {
        covered[offset] = true;
      }
    }

    for (let offset = 0; offset < text.length; offset += 1) {
      const char = text[offset];
      if (char !== undefined && !/\s/u.test(char)) {
        expect(covered[offset]).toBe(true);
      }
    }

    for (let index = 1; index < chunks.length; index += 1) {
      const previous = chunks[index - 1];
      const current = chunks[index];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      if (previous === undefined || current === undefined) {
        continue;
      }
      expect(current.startOffset).toBeGreaterThan(previous.startOffset);
      expect(current.startOffset).toBeLessThan(previous.endOffset);
    }
  });

  it("keeps page numbers and offsets across pages", () => {
    const chunks = chunkText(
      {
        segments: [
          { page: 1, text: "alpha beta gamma" },
          { page: 2, text: "delta epsilon zeta" },
        ],
      },
      { maxCharacters: 200, overlapCharacters: 0 },
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      text: "alpha beta gamma\n\ndelta epsilon zeta",
      startOffset: 0,
      pageStart: 1,
      pageEnd: 2,
    });
    expect(documentChunkSchema.parse(chunks[0])).toEqual(chunks[0]);
  });

  it("hard-splits a token longer than the chunk size", () => {
    const chunks = chunkText("abcdefghij", {
      maxCharacters: 4,
      overlapCharacters: 0,
    });

    expect(chunks.map((chunk) => chunk.text)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("rejects overlap that is not smaller than the chunk size", () => {
    expect(() => chunkText("hello", { maxCharacters: 0 })).toThrow(RangeError);
    expect(() =>
      chunkText("hello", { maxCharacters: 8, overlapCharacters: 8 }),
    ).toThrow(RangeError);
    expect(() => chunkText("hello", { overlapCharacters: -1 })).toThrow(
      RangeError,
    );
  });

  it("uses the default size for a few hundred characters and splits a longer text", () => {
    expect(chunkText("word ".repeat(80))).toHaveLength(1);
    expect(chunkText("word ".repeat(600)).length).toBeGreaterThan(1);
  });
});

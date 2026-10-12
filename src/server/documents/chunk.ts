import "server-only";

import type { DocumentChunk } from "@/schemas";

/**
 * Split extracted text into overlapping chunks.
 *
 * Size is measured in characters, about four per token, so the default
 * is roughly 500 tokens with about 100 tokens of overlap. Breaks prefer
 * whitespace. Offsets refer to the normalized extracted text.
 */

/** About 500 tokens, at roughly four characters per token. */
export const DEFAULT_CHUNK_MAX_CHARACTERS = 2_000;

/** About 100 tokens of overlap between adjacent chunks. */
export const DEFAULT_CHUNK_OVERLAP_CHARACTERS = 400;

export type ChunkOptions = {
  maxCharacters?: number;
  overlapCharacters?: number;
};

export type ChunkSource =
  | string
  | {
      segments: readonly { page: number | null; text: string }[];
    };

type PageRange = {
  start: number;
  end: number;
  page: number | null;
};

export function chunkText(
  source: ChunkSource,
  options?: ChunkOptions,
): DocumentChunk[] {
  const { maxCharacters, overlapCharacters } = resolveOptions(options);
  const { text, ranges } = flatten(source);
  const chunks: DocumentChunk[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    cursor = skipWhitespace(text, cursor);
    if (cursor >= text.length) {
      break;
    }

    let end = findChunkEnd(text, cursor, maxCharacters);
    end = trimTrailingWhitespace(text, cursor, end);
    if (end <= cursor) {
      end = Math.min(cursor + maxCharacters, text.length);
    }

    const pageStart = pageAt(ranges, cursor);
    const pageEnd = pageAt(ranges, end - 1);
    chunks.push({
      index: chunks.length,
      text: text.slice(cursor, end),
      startOffset: cursor,
      endOffset: end,
      pageStart,
      pageEnd,
    });

    if (end >= text.length) {
      break;
    }

    let next = end - overlapCharacters;
    if (next <= cursor) {
      next = end;
    } else {
      next = snapToWordStart(text, next, end);
      if (next <= cursor) {
        next = end;
      }
    }
    cursor = next;
  }

  return chunks;
}

function resolveOptions(options: ChunkOptions | undefined): {
  maxCharacters: number;
  overlapCharacters: number;
} {
  const maxCharacters = options?.maxCharacters ?? DEFAULT_CHUNK_MAX_CHARACTERS;
  const overlapCharacters =
    options?.overlapCharacters ?? DEFAULT_CHUNK_OVERLAP_CHARACTERS;

  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) {
    throw new RangeError("maxCharacters must be a positive integer");
  }

  if (!Number.isInteger(overlapCharacters) || overlapCharacters < 0) {
    throw new RangeError("overlapCharacters must be a non-negative integer");
  }

  if (overlapCharacters >= maxCharacters) {
    throw new RangeError(
      "overlapCharacters must be smaller than maxCharacters",
    );
  }

  return { maxCharacters, overlapCharacters };
}

function flatten(source: ChunkSource): { text: string; ranges: PageRange[] } {
  if (typeof source === "string") {
    const text = normalizeNewlines(source);
    return {
      text,
      ranges:
        text.length === 0 ? [] : [{ start: 0, end: text.length, page: null }],
    };
  }

  let text = "";
  const ranges: PageRange[] = [];

  for (const segment of source.segments) {
    const normalized = normalizeNewlines(segment.text);
    if (normalized.trim().length === 0) {
      continue;
    }

    if (text.length > 0) {
      text += "\n\n";
    }

    const start = text.length;
    text += normalized;
    ranges.push({ start, end: text.length, page: segment.page });
  }

  return { text, ranges };
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isWhitespace(char: string): boolean {
  return /\s/u.test(char);
}

function skipWhitespace(text: string, index: number): number {
  let cursor = index;
  while (cursor < text.length) {
    const char = text[cursor];
    if (char === undefined || !isWhitespace(char)) {
      break;
    }
    cursor += 1;
  }
  return cursor;
}

function trimTrailingWhitespace(
  text: string,
  start: number,
  end: number,
): number {
  let cursor = end;
  while (cursor > start) {
    const char = text[cursor - 1];
    if (char === undefined || !isWhitespace(char)) {
      break;
    }
    cursor -= 1;
  }
  return cursor;
}

function findChunkEnd(
  text: string,
  start: number,
  maxCharacters: number,
): number {
  const hardEnd = Math.min(start + maxCharacters, text.length);
  if (hardEnd >= text.length) {
    return text.length;
  }

  for (let index = hardEnd; index > start; index -= 1) {
    const char = text[index - 1];
    if (char !== undefined && isWhitespace(char)) {
      return index - 1;
    }
  }

  return hardEnd;
}

function snapToWordStart(text: string, index: number, limit: number): number {
  if (index <= 0) {
    return 0;
  }

  const previous = text[index - 1];
  if (previous === undefined || isWhitespace(previous)) {
    return index;
  }

  const windowEnd = Math.min(limit, text.length);
  for (let cursor = index; cursor < windowEnd; cursor += 1) {
    const char = text[cursor];
    if (char !== undefined && isWhitespace(char)) {
      return cursor;
    }
  }

  return index;
}

function pageAt(ranges: readonly PageRange[], offset: number): number | null {
  let low = 0;
  let high = ranges.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const range = ranges[mid];
    if (range === undefined) {
      return null;
    }

    if (offset < range.start) {
      high = mid - 1;
    } else if (offset >= range.end) {
      low = mid + 1;
    } else {
      return range.page;
    }
  }

  return null;
}

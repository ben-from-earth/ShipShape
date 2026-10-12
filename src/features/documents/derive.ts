import type { Document, DocumentSearchHit } from "@/schemas";

import { mediaTypeForFile } from "./upload-rules";

export { mediaTypeForFile } from "./upload-rules";

/**
 * Page label for a hit. Omitted when the format has no pages.
 * A single page and a span both use the chunk's 1-based numbers.
 */
export function formatPageRange(
  pageStart: number | null,
  pageEnd: number | null,
): string | null {
  if (pageStart == null || pageEnd == null) {
    return null;
  }

  if (pageStart === pageEnd) {
    return `p. ${pageStart}`;
  }

  return `p. ${pageStart}\u2013${pageEnd}`;
}

/** Bar width for a cosine score. Negative similarity draws an empty bar. */
export function scorePercent(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export function rankDemoHits(
  hits: readonly DocumentSearchHit[],
  query: string,
  limit = 10,
): DocumentSearchHit[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 1);

  return hits
    .map((hit) => {
      const haystack =
        `${hit.documentTitle} ${hit.snippet} ${hit.chunk.text}`.toLowerCase();
      const matches = terms.filter((term) => haystack.includes(term)).length;
      return { hit, matches };
    })
    .filter((row) => row.matches > 0)
    .sort(
      (left, right) =>
        right.matches - left.matches || right.hit.score - left.hit.score,
    )
    .slice(0, limit)
    .map((row) => row.hit);
}

export function documentFromFile(
  file: { name: string; type: string },
  options: { id: string; createdAt: string },
): Document | null {
  const mediaType = mediaTypeForFile(file.name, file.type);
  if (!mediaType) {
    return null;
  }

  const base = file.name.replace(/\.[^.]+$/, "").trim() || file.name.trim();
  const title = base.slice(0, 200);

  return {
    id: options.id,
    title,
    storageKey: `demo/${file.name}`.slice(0, 500),
    mediaType,
    uploadedBy: "Demo",
    createdAt: options.createdAt,
  };
}

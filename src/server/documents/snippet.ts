import "server-only";

/** Search snippets stay near this length and end on a word boundary. */
export const SNIPPET_MAX_CHARACTERS = 300;

/**
 * A single-line excerpt of chunk text. Whitespace is collapsed. When the
 * text is longer than the limit, the cut moves back to the previous space
 * so a word is not split. A single word longer than the limit is cut at
 * the limit.
 */
export function buildSnippet(
  text: string,
  maxCharacters = SNIPPET_MAX_CHARACTERS,
): string {
  const normalized = text.trim().replace(/\s+/gu, " ");
  if (normalized.length <= maxCharacters) {
    return normalized;
  }

  const window = normalized.slice(0, maxCharacters);
  const lastSpace = window.lastIndexOf(" ");
  if (lastSpace <= 0) {
    return window;
  }

  return window.slice(0, lastSpace);
}

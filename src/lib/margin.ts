import { LOW_MARGIN_THRESHOLD } from "@/config/analysis";

/** How a margin of safety should be drawn. Negative is always critical. */
export type MarginClass = "negative" | "low" | "ok" | "missing";

const MARGIN_COLOR: Record<MarginClass, string> = {
  negative: "#c8361f",
  low: "#b07d0e",
  ok: "#2f5d50",
  missing: "#8a8f98",
};

/**
 * Classify a margin of safety.
 *
 * - missing: null, undefined, or NaN
 * - negative: below zero (always red, even if the threshold is lower)
 * - low: zero up to, but not including, the threshold
 * - ok: at or above the threshold
 */
export function classifyMargin(
  margin: number | null | undefined,
  threshold = LOW_MARGIN_THRESHOLD,
): MarginClass {
  if (margin == null || Number.isNaN(margin)) {
    return "missing";
  }

  if (margin < 0) {
    return "negative";
  }

  if (margin < threshold) {
    return "low";
  }

  return "ok";
}

/** Sign plus two decimals. Negatives use U+2212, missing values an em dash. */
export function formatMargin(margin: number | null | undefined): string {
  if (margin == null || Number.isNaN(margin)) {
    return "\u2014";
  }

  const absolute = Math.abs(margin).toFixed(2);

  if (margin < 0) {
    return `\u2212${absolute}`;
  }

  return `+${absolute}`;
}

/** Foreground color for a margin. Low margins use the canonical amber. */
export function marginColor(
  margin: number | null | undefined,
  threshold = LOW_MARGIN_THRESHOLD,
): string {
  return MARGIN_COLOR[classifyMargin(margin, threshold)];
}

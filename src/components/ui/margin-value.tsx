import { LOW_MARGIN_THRESHOLD } from "@/config/analysis";
import { classifyMargin, formatMargin, type MarginClass } from "@/lib/margin";
import { cn } from "@/lib/utils";

const toneClass: Record<MarginClass, string> = {
  negative: "text-accent",
  low: "text-warn",
  ok: "text-ok",
  missing: "text-ink-faint",
};

export function marginToneClass(
  margin: number | null | undefined,
  threshold = LOW_MARGIN_THRESHOLD,
): string {
  return toneClass[classifyMargin(margin, threshold)];
}

export function MarginValue({
  margin,
  threshold = LOW_MARGIN_THRESHOLD,
  className,
}: {
  margin: number | null | undefined;
  /** Organization cutoff. Defaults to `LOW_MARGIN_THRESHOLD`. */
  threshold?: number;
  className?: string;
}) {
  return (
    <span className={cn("font-mono", className)}>
      <span className={marginToneClass(margin, threshold)}>
        {formatMargin(margin)}
      </span>
    </span>
  );
}

import { classifyMargin, formatMargin, type MarginClass } from "@/lib/margin";
import { cn } from "@/lib/utils";

const toneClass: Record<MarginClass, string> = {
  negative: "text-accent",
  low: "text-warn",
  ok: "text-ok",
  missing: "text-ink-faint",
};

export function marginToneClass(margin: number | null | undefined): string {
  return toneClass[classifyMargin(margin)];
}

export function MarginValue({
  margin,
  className,
}: {
  margin: number | null | undefined;
  className?: string;
}) {
  return (
    <span className={cn("font-mono", marginToneClass(margin), className)}>
      {formatMargin(margin)}
    </span>
  );
}

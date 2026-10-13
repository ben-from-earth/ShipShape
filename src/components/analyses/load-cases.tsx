import { MarginValue } from "@/components/ui/margin-value";
import { marginBarPercent } from "@/features/analyses/derive";
import { marginColor } from "@/lib/margin";

/**
 * The analysis load case and its margin. `marginThreshold` is the
 * organization cutoff from the server page. This component does not read it.
 */
export function LoadCaseMargins({
  loadCase,
  margin,
  marginThreshold,
}: {
  loadCase: string | null;
  margin: number | null;
  marginThreshold: number;
}) {
  if (loadCase == null && margin == null) {
    return <p className="text-body text-ink-muted">No load case yet.</p>;
  }

  const name = loadCase ?? "Load case";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body text-ink">{name}</span>
        <MarginValue
          margin={margin}
          threshold={marginThreshold}
          className="text-body font-semibold"
        />
      </div>
      <span className="h-[3px] bg-line-faint" aria-hidden>
        <span
          className="block h-[3px]"
          style={{
            width: margin == null ? "0%" : `${marginBarPercent(margin)}%`,
            backgroundColor: marginColor(margin, marginThreshold),
          }}
        />
      </span>
    </div>
  );
}

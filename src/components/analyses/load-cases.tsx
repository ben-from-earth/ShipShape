import { MarginValue } from "@/components/ui/margin-value";
import type { AnalysisLoadCase } from "@/features/analyses/view";
import { marginBarPercent } from "@/features/analyses/derive";
import { marginColor } from "@/lib/margin";

/**
 * Load cases for one analysis. `marginThreshold` is the organization
 * cutoff from the server page. This component does not read it.
 */
export function LoadCaseMargins({
  cases,
  marginThreshold,
}: {
  cases: readonly AnalysisLoadCase[];
  marginThreshold: number;
}) {
  if (cases.length === 0) {
    return <p className="text-body text-ink-muted">No load cases yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {cases.map((entry) => (
        <li key={entry.name} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-body text-ink">{entry.name}</span>
            <MarginValue
              margin={entry.margin}
              threshold={marginThreshold}
              className="text-body font-semibold"
            />
          </div>
          <span className="h-[3px] bg-line-faint" aria-hidden>
            <span
              className="block h-[3px]"
              style={{
                width:
                  entry.margin == null
                    ? "0%"
                    : `${marginBarPercent(entry.margin)}%`,
                backgroundColor: marginColor(entry.margin, marginThreshold),
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

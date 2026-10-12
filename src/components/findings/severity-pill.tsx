import { StatusPill } from "@/components/ui/status-pill";
import type { Severity } from "@/config/severity";

/** Medium uses the warning amber. Low stays neutral. High and critical use accent. */
const SEVERITY_TONE = {
  low: "neutral",
  medium: "warn",
  high: "accent",
  critical: "accent",
} as const satisfies Record<Severity, "neutral" | "warn" | "accent">;

export function SeverityPill({ severity }: { severity: Severity }) {
  return <StatusPill label={severity} tone={SEVERITY_TONE[severity]} />;
}

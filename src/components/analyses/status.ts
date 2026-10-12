import type { AnalysisStatus } from "@/features/analyses/types";

/** Status chip colors. Checker review uses the canonical warning amber. */
export const STATUS_CLASS: Record<AnalysisStatus, string> = {
  draft: "bg-line-faint text-ink-3",
  work: "bg-navy text-white",
  check: "bg-warn text-white",
  rework: "bg-accent text-white",
  ready: "bg-ok text-white",
  done: "border border-ok bg-surface text-ok",
};

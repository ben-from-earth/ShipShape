import { findingStageSchema, type FindingStage } from "@/schemas";

export const STAGE_LABEL = {
  discovered: "Discovered",
  repair_defined: "Repair defined",
  analysis: "Analysis",
  review: "Review",
  approved: "Approved",
  closed: "Closed",
} as const satisfies Record<FindingStage, string>;

export const FINDING_STAGES = findingStageSchema.options;

export function formatFindingDate(createdAt: string): string {
  const instant = new Date(createdAt);
  if (Number.isNaN(instant.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(instant);
}

import { StatusPill } from "@/components/ui/status-pill";
import { REPAIR_STATUS_LABEL } from "@/features/repairs/display";
import type { RepairStatus } from "@/schemas";

const TONE = {
  draft: "outline",
  written: "outline",
  in_review: "warn",
  approved: "ok",
  awaiting_analysis: "warn",
  analysis_approved: "ok",
  complete: "ok",
} as const satisfies Record<RepairStatus, "outline" | "warn" | "ok">;

export function RepairStatusPill({ status }: { status: RepairStatus }) {
  return <StatusPill label={REPAIR_STATUS_LABEL[status]} tone={TONE[status]} />;
}

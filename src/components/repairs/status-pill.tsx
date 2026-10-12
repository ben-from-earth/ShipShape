import { StatusPill } from "@/components/ui/status-pill";
import { REPAIR_STATUS_LABEL } from "@/features/repairs/display";
import type { RepairStatus } from "@/schemas";

const TONE = {
  open: "outline",
  in_review: "warn",
  completed: "ok",
} as const satisfies Record<RepairStatus, "outline" | "warn" | "ok">;

export function RepairStatusPill({ status }: { status: RepairStatus }) {
  return <StatusPill label={REPAIR_STATUS_LABEL[status]} tone={TONE[status]} />;
}

import { REPAIR_STATUSES, type RepairStatus } from "@/config/repairs";

export const REPAIR_STATUS_LABEL = {
  open: "Open",
  in_review: "In review",
  completed: "Completed",
} as const satisfies Record<RepairStatus, string>;

export const REPAIR_STATUS_OPTIONS = REPAIR_STATUSES;

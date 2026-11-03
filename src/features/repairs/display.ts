import { REPAIR_STATUSES, type RepairStatus } from "@/config/repairs";
import type { Repair } from "@/schemas";

export const REPAIR_STATUS_LABEL = {
  draft: "Draft",
  written: "Repair written",
  in_review: "Repair in review",
  approved: "Repair approved",
  awaiting_analysis: "Awaiting analysis",
  analysis_approved: "Analysis approved",
  complete: "Repair complete",
} as const satisfies Record<RepairStatus, string>;

export const REPAIR_STATUS_OPTIONS = REPAIR_STATUSES;

/**
 * Asset text for a repair. A name is shown when the asset has one.
 * Otherwise the identifier is shown. A blank identifier is a dash.
 */
export function repairAssetLabel(
  asset: Pick<Repair["asset"], "name" | "identifier">,
): string {
  const name = asset.name?.trim() ?? "";
  if (name) {
    return name;
  }

  const identifier = asset.identifier.trim();
  return identifier || "—";
}

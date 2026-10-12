import type { Repair } from "@/schemas";

/**
 * A repair plus the finding code and asset label the list and detail pages
 * show. Those labels are copied from `repair.finding` and `repair.asset`,
 * which `listRepairs` and `getRepair` load in the same join.
 */
export type RepairView = Repair & {
  findingCode: string | null;
  assetIdentifier: string | null;
  assetName: string | null;
};

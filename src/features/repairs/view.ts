import type { Repair } from "@/schemas";

/**
 * A repair plus the finding code and asset the list and detail pages show.
 * Those two fields are not columns on `repairs`. They come from the finding.
 */
export type RepairView = Repair & {
  findingCode: string | null;
  assetIdentifier: string | null;
  assetName: string | null;
};

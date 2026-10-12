/**
 * Asset choices for the intake form until a list route exists.
 * The group and asset match `demoIds` in `src/db/demo-seed.ts`.
 * T-45 wording here is fixture content.
 */

export type FindingAssetGroup = {
  id: string;
  name: string;
  assetType: string | null;
};

export type FindingAsset = {
  id: string;
  groupId: string;
  identifier: string;
  name: string;
};

export const FINDING_ASSET_GROUPS: readonly FindingAssetGroup[] = [
  {
    id: "10000000-0000-4000-8000-000000000021",
    name: "T-45 Goshawk",
    assetType: "aircraft",
  },
];

export const FINDING_ASSETS: readonly FindingAsset[] = [
  {
    id: "10000000-0000-4000-8000-000000000022",
    groupId: "10000000-0000-4000-8000-000000000021",
    identifier: "DEMO-T45-001",
    name: "Demo airframe",
  },
];

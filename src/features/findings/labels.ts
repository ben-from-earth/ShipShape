export type AssetFieldLabels = {
  identifier: string;
  location: string;
};

const DEFAULT_LABELS: AssetFieldLabels = {
  identifier: "Identifier",
  location: "Location",
};

/**
 * Labels that come from the asset type. Unknown types, including the
 * demo aircraft group, keep Identifier and Location.
 */
const LABELS_BY_ASSET_TYPE: Record<string, AssetFieldLabels> = {
  bridge: { identifier: "Structure id", location: "Span" },
};

export function fieldLabels(
  assetType: string | null | undefined,
): AssetFieldLabels {
  if (!assetType) {
    return DEFAULT_LABELS;
  }

  return LABELS_BY_ASSET_TYPE[assetType] ?? DEFAULT_LABELS;
}

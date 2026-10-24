/**
 * Analysis checklist items. Tenants will replace this list; these are the
 * seeded defaults so a new organization has something to check off.
 * An analysis can have a writer plus at most one approving engineer per
 * checked item.
 */
export const DEFAULT_ANALYSIS_FIELDS = [
  "Peak Stress",
  "Static Strength",
  "Fatigue",
  "Damage Tolerance",
  "Residual Strength",
] as const;

export type AnalysisFieldName = (typeof DEFAULT_ANALYSIS_FIELDS)[number];

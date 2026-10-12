/**
 * Demo program shown until organization and asset records exist.
 * T-45 content belongs here and in feature fixtures, not in chrome labels.
 */
export const DEMO_ASSET_GROUP_NAME = "T-45 Goshawk";
export const DEMO_AS_OF = "2026-10-06";
export const DEMO_AS_OF_LABEL = "Oct 6, 2026";

/**
 * Docs demo data is off unless this public flag is exactly `"true"`.
 * Read at call time so a test can toggle it without reloading the module.
 */
export function isDemoData(): boolean {
  return process.env.NEXT_PUBLIC_DOCS_DEMO_MODE === "true";
}

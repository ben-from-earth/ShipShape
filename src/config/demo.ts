/**
 * Demo program shown until organization and asset records exist.
 * T-45 content belongs here and in feature fixtures, not in chrome labels.
 */
export const DEMO_ASSET_GROUP_NAME = "T-45 Goshawk";
export const DEMO_AS_OF = "2026-10-06";
export const DEMO_AS_OF_LABEL = "Oct 6, 2026";

/**
 * Demo data is off unless a public flag is exactly `"true"`.
 * `NEXT_PUBLIC_DEMO_MODE` covers the app. `NEXT_PUBLIC_DOCS_DEMO_MODE`
 * remains for the Docs page. Read at call time so a test can toggle it.
 */
export function isDemoData(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DOCS_DEMO_MODE === "true"
  );
}

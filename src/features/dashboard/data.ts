import "server-only";

/**
 * Page entry for the dashboard. This is the one import that chooses the
 * database readers. Point it at `./demo` to render the typed fixtures.
 *
 * `getLowMarginThreshold` reads the organization's cutoff and falls back
 * to 0.10. Server pages pass that number into the analysis UI. Client
 * components do not import this module.
 */
export { dashboardPeriods, getDashboard, getDashboards } from "./db";
export { getLowMarginThreshold } from "@/lib/org-threshold";

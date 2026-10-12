import "server-only";

/**
 * Page entry for the dashboard. This is the one import that chooses the
 * database readers. Point it at `./demo` to render the typed fixtures.
 */
export { dashboardPeriods, getDashboard, getDashboards } from "./db";

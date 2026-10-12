import "server-only";

/**
 * Page entry for the analysis list. This is the one import that chooses
 * the database reader. Point it at `./demo` to render the typed fixtures.
 */
export { listAnalyses } from "./db";

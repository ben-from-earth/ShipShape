import "server-only";

/**
 * Page entry for the analysis list. This is the one import that chooses
 * the database reader. Point it at `./demo` to render the typed fixtures.
 * `createAnalysis` and `getAnalysis` stay on the database writer.
 */
export { getAnalysesPage, listAnalyses } from "./db";
export { createAnalysis, getAnalysis } from "./write";
export type {
  AnalysisStore,
  CreateAnalysisInput,
  CreateAnalysisResult,
} from "./write";

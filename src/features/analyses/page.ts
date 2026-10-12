import "server-only";

import { io } from "next/cache";

import { isDemoData } from "@/config/demo";

import { findDemoAnalysis } from "./page-demo";
import type { AnalysisView } from "./view";

/**
 * One analysis for `/analyses/[id]`.
 * Demo rows are used only when `isDemoData()` is on. With the flag off
 * this returns null, including when the database is unset. It does not
 * fill the page with the engineering-list fixtures.
 *
 * TODO(#33): when `getAnalysis` lands, read the row here and map it onto
 * `AnalysisView`. Keep the demo branch behind `isDemoData()`.
 */
export async function getAnalysisView(
  id: string,
): Promise<AnalysisView | null> {
  await io();

  const key = id.trim();
  if (!key || !isDemoData()) {
    return null;
  }

  return findDemoAnalysis(key);
}

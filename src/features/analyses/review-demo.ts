import "server-only";

import { reviewHistorySchema, type ReviewHistory } from "./review-history";

/**
 * Demo review for an explicit `isDemoData()` session.
 * Ids match `demoReview` in `src/db/demo-seed.ts`.
 * This module is not a stand-in for a missing database.
 */
const DEMO_ANALYSIS_ID = "10000000-0000-4000-8000-000000000051";

const DEMO_REVIEW: ReviewHistory = reviewHistorySchema.parse({
  id: "10000000-0000-4000-8000-000000000054",
  analysisId: DEMO_ANALYSIS_ID,
  decision: "pending",
  comment: null,
  createdAt: "2026-10-06T12:00:00.000Z",
});

export function findDemoReviews(analysisId: string): ReviewHistory[] {
  if (analysisId !== DEMO_REVIEW.analysisId) {
    return [];
  }
  return [DEMO_REVIEW];
}

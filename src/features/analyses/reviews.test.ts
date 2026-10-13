import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { listAnalysisReviews } from "./reviews";

const demoAnalysisId = "10000000-0000-4000-8000-000000000051";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("listAnalysisReviews", () => {
  it("returns an empty list when demo mode is off and there is no database", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "");
    vi.stubEnv("DATABASE_URL", "");

    await expect(listAnalysisReviews(demoAnalysisId)).resolves.toEqual([]);
    await expect(listAnalysisReviews("not-a-uuid")).resolves.toEqual([]);
  });

  it("returns the seeded review only when demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "");

    await expect(listAnalysisReviews(demoAnalysisId)).resolves.toEqual([
      {
        id: "10000000-0000-4000-8000-000000000054",
        analysisId: demoAnalysisId,
        decision: "pending",
        comment: null,
        createdAt: "2026-10-06T12:00:00.000Z",
      },
    ]);
    await expect(
      listAnalysisReviews("10000000-0000-4000-8000-000000000099"),
    ).resolves.toEqual([]);
  });
});

describe("review history reader", () => {
  it("scopes reviews to the organization and does not use demo data unless asked", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "reviews.ts"),
      "utf8",
    );
    expect(source).toContain("isDemoData()");
    expect(source).toContain("eq(assets.orgId, orgId)");
    expect(source).toContain("eq(analyses.id, analysisId)");
  });
});

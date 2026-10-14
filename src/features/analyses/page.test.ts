import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getAnalysisPage } from "./page";

const demoId = "10000000-0000-4000-8000-000000000051";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAnalysisPage", () => {
  it("returns null when demo mode is off and there is no database", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "");
    vi.stubEnv("DATABASE_URL", "");

    await expect(getAnalysisPage(demoId)).resolves.toBeNull();
    await expect(getAnalysisPage("not-a-uuid")).resolves.toBeNull();
  });

  it("returns the seeded analysis only when demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "");

    await expect(getAnalysisPage(demoId)).resolves.toMatchObject({
      id: demoId,
      code: "AN-1001",
      repairId: "10000000-0000-4000-8000-000000000041",
      revision: "A",
      method: "Hand calculation",
      loadCase: "Limit load",
      margin: 0.04,
      status: "in_review",
    });
    await expect(
      getAnalysisPage("10000000-0000-4000-8000-000000000099"),
    ).resolves.toBeNull();
  });
});

describe("analysis page imports", () => {
  it("reads the board record only through the demo gate", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const page = readFileSync(
      join(root, "app/(app)/analyses/[id]/page.tsx"),
      "utf8",
    );
    const reader = readFileSync(
      join(root, "features/analyses/board-page.ts"),
      "utf8",
    );

    expect(page).toContain("getAnalysisBoard");
    expect(page).not.toContain("marginThreshold");
    expect(reader).toContain("isDemoData()");
    expect(reader).toContain("findDemoAnalysis");
  });
});

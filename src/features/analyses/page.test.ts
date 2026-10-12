import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getAnalysisView } from "./page";

const demoId = "10000000-0000-4000-8000-000000000051";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAnalysisView", () => {
  it("returns null when demo mode is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "");

    await expect(getAnalysisView(demoId)).resolves.toBeNull();
    await expect(getAnalysisView("AN-1001")).resolves.toBeNull();
    await expect(getAnalysisView("SA-26-114")).resolves.toBeNull();
    await expect(getAnalysisView("  ")).resolves.toBeNull();
  });

  it("returns the seeded analysis and a list fixture when demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "");

    const seeded = await getAnalysisView(demoId);
    expect(seeded).toMatchObject({
      id: demoId,
      code: "AN-1001",
      method: "Hand calculation",
      status: "in_review",
      repair: {
        id: "10000000-0000-4000-8000-000000000041",
        code: "REP-1001",
        revision: "A",
      },
      finding: {
        id: "10000000-0000-4000-8000-000000000031",
        code: "ISS-1001",
      },
    });
    expect(seeded?.loadCases.map((entry) => entry.margin)).toEqual([
      0.25, 0.04, -0.06,
    ]);
    await expect(getAnalysisView("AN-1001")).resolves.toMatchObject({
      id: demoId,
    });

    const listed = await getAnalysisView("SA-26-109");
    expect(listed).toMatchObject({
      code: "SA-26-109",
      status: "changes_requested",
      repair: { revision: "C" },
    });
    expect(
      listed?.loadCases.some(
        (entry) => entry.margin != null && entry.margin < 0,
      ),
    ).toBe(true);
    await expect(getAnalysisView("missing")).resolves.toBeNull();
  });
});

describe("analysis page imports", () => {
  it("reads the cutoff in the server page and keeps it out of the client form", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
    const page = readFileSync(
      join(root, "app/(app)/analyses/[id]/page.tsx"),
      "utf8",
    );
    const repairPage = readFileSync(
      join(root, "app/(app)/repairs/[id]/page.tsx"),
      "utf8",
    );
    const form = readFileSync(
      join(root, "components/analyses/create-analysis.tsx"),
      "utf8",
    );
    const record = readFileSync(
      join(root, "components/analyses/analysis-record.tsx"),
      "utf8",
    );
    const cases = readFileSync(
      join(root, "components/analyses/load-cases.tsx"),
      "utf8",
    );

    expect(page).toContain(
      'import { getLowMarginThreshold } from "@/features/dashboard/data"',
    );
    expect(page).toContain("marginThreshold={marginThreshold}");
    expect(repairPage).toContain(
      'import { getLowMarginThreshold } from "@/features/dashboard/data"',
    );
    for (const source of [form, record, cases]) {
      expect(source).not.toContain('from "@/features/dashboard/data"');
      expect(source).not.toContain('from "@/lib/org-threshold"');
      expect(source).not.toContain('from "@/db');
      expect(source).not.toMatch(/\bfetch\s*\(/);
    }
  });
});

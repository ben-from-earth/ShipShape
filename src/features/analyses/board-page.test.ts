import { afterEach, describe, expect, it, vi } from "vitest";

import {
  analysisBoardSummary,
  getAnalysisBoard,
  listAnalysisBoard,
} from "./board-page";

const demoId = "10000000-0000-4000-8000-000000000082";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("analysis board pages", () => {
  it("returns nothing when demo mode is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "");

    await expect(listAnalysisBoard()).resolves.toMatchObject({ records: [] });
    await expect(getAnalysisBoard(demoId)).resolves.toBeNull();
  });

  it("returns the demo rows and summary only when demo mode is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");

    const listed = await listAnalysisBoard({ status: "assigned" });
    expect(listed.records.map((record) => record.code)).toEqual(["AN-2002"]);
    expect(listed.records[0]?.assignee?.name).toBe("Ada Analyst");

    const detail = await getAnalysisBoard(
      "10000000-0000-4000-8000-000000000085",
    );
    expect(detail?.record.code).toBe("AN-2005");
    expect(detail?.role).toBe("reviewer");
    expect(detail?.record.comments).toHaveLength(1);

    const { summary } = await analysisBoardSummary();
    expect(summary.counts).toEqual({
      unassigned: 1,
      assigned: 1,
      in_progress: 1,
      waiting_for_review: 1,
      in_review: 1,
      approved: 1,
    });
    expect(summary.overdue).toBe(1);
    expect(summary.dueThisWeek).toBe(3);
    expect(summary.averageApprovalDays).toBe(10);
  });
});

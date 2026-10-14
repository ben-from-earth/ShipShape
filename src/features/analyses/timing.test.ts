import { describe, expect, it } from "vitest";

import {
  ageDays,
  averageApprovalDays,
  dueBadge,
  isDueThisWeek,
} from "./timing";

const asOf = "2026-10-06";

describe("analysis timing", () => {
  it("counts age in whole UTC days", () => {
    expect(ageDays("2026-10-04T18:00:00.000Z", asOf)).toBe(2);
    expect(ageDays("2026-10-08T00:00:00.000Z", asOf)).toBe(0);
  });

  it("marks a past due date overdue and a date within 3 days due soon", () => {
    expect(dueBadge("2026-10-05", "in_progress", asOf)).toBe("overdue");
    expect(dueBadge("2026-10-06", "assigned", asOf)).toBe("due-soon");
    expect(dueBadge("2026-10-09", "in_review", asOf)).toBe("due-soon");
    expect(dueBadge("2026-10-10", "in_review", asOf)).toBeNull();
    expect(dueBadge("2026-10-01", "approved", asOf)).toBeNull();
    expect(dueBadge(null, "assigned", asOf)).toBeNull();
  });

  it("counts due this week as today through six days, excluding approved", () => {
    expect(isDueThisWeek("2026-10-12", "in_review", asOf)).toBe(true);
    expect(isDueThisWeek("2026-10-13", "in_review", asOf)).toBe(false);
    expect(isDueThisWeek("2026-10-05", "assigned", asOf)).toBe(false);
    expect(isDueThisWeek("2026-10-08", "approved", asOf)).toBe(false);
  });

  it("keeps the local calendar date near midnight", () => {
    const beforeLocalMidnight = "2026-10-07T00:30:00.000Z";
    const afterLocalMidnight = "2026-10-07T04:30:00.000Z";

    expect(
      dueBadge(
        "2026-10-06",
        "assigned",
        beforeLocalMidnight,
        "America/New_York",
      ),
    ).toBe("due-soon");
    expect(
      isDueThisWeek(
        "2026-10-06",
        "assigned",
        beforeLocalMidnight,
        "America/New_York",
      ),
    ).toBe(true);
    expect(dueBadge("2026-10-06", "assigned", beforeLocalMidnight, "UTC")).toBe(
      "overdue",
    );
    expect(
      dueBadge(
        "2026-10-06",
        "assigned",
        "2026-10-07T06:30:00.000Z",
        "America/Los_Angeles",
      ),
    ).toBe("due-soon");
    expect(
      dueBadge(
        "2026-10-06",
        "assigned",
        afterLocalMidnight,
        "America/New_York",
      ),
    ).toBe("overdue");
    expect(
      isDueThisWeek(
        "2026-10-06",
        "assigned",
        afterLocalMidnight,
        "America/New_York",
      ),
    ).toBe(false);
  });

  it("averages days from creation to approval", () => {
    expect(
      averageApprovalDays([
        { createdAt: "2026-09-21", approvedAt: "2026-10-01" },
        { createdAt: "2026-10-01", approvedAt: null },
      ]),
    ).toBe(10);
    expect(
      averageApprovalDays([{ createdAt: "2026-10-01", approvedAt: null }]),
    ).toBe(null);
  });
});

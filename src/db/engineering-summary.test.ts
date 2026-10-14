import { describe, expect, it } from "vitest";

import { analysisSummarySchema } from "@/schemas";

import { summarizeAnalyses } from "./engineering";

const today = "2026-10-14";

function row(
  status: string,
  dueDate: string | null,
  createdAt = "2026-10-01T00:00:00.000Z",
  approvedAt: string | null = null,
) {
  return { status, dueDate, createdAt, approvedAt };
}

describe("summarizeAnalyses", () => {
  it("counts every status and the due-date cards", async () => {
    const execute = async () => [
      row("unassigned", "2026-10-13"),
      row("assigned", today),
      row("in_progress", "2026-10-17"),
      row("waiting_for_review", "2026-10-18"),
      row("in_review", null),
      row(
        "approved",
        "2026-10-01",
        "2026-10-01T00:00:00.000Z",
        "2026-10-03T00:00:00.000Z",
      ),
      row(
        "approved",
        null,
        "2026-10-01T00:00:00.000Z",
        "2026-10-02T00:00:00.000Z",
      ),
    ];

    const summary = analysisSummarySchema.parse(
      await summarizeAnalyses({ execute } as never, today),
    );

    expect(summary.counts).toEqual({
      unassigned: 1,
      assigned: 1,
      in_progress: 1,
      waiting_for_review: 1,
      in_review: 1,
      approved: 2,
    });
    expect(summary.overdue).toBe(1);
    expect(summary.dueSoon).toBe(2);
    expect(summary.avgDaysToApproval).toBe(1.5);
  });

  it("returns null average and zero counts when the tenant has no analyses", async () => {
    const summary = await summarizeAnalyses(
      { execute: async () => [] } as never,
      today,
    );

    expect(summary.avgDaysToApproval).toBeNull();
    expect(summary.overdue).toBe(0);
    expect(summary.dueSoon).toBe(0);
    expect(summary.counts).toEqual({
      unassigned: 0,
      assigned: 0,
      in_progress: 0,
      waiting_for_review: 0,
      in_review: 0,
      approved: 0,
    });
  });
});

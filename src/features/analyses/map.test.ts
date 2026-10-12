import { describe, expect, it } from "vitest";

import type { TenantSnapshot } from "@/db/snapshot";
import { emptySnapshot } from "@/db/snapshot";

import { buildAnalysisRecords, mapAnalysisStatus } from "./map";

describe("mapAnalysisStatus", () => {
  it("splits in-review into a check or a ready-to-approve queue", () => {
    expect(mapAnalysisStatus("draft", [])).toBe("draft");
    expect(mapAnalysisStatus("in_progress", [])).toBe("work");
    expect(mapAnalysisStatus("changes_requested", [])).toBe("rework");
    expect(mapAnalysisStatus("approved", [])).toBe("done");
    expect(
      mapAnalysisStatus("in_review", [
        { decision: "pending", reviewerRole: "checker" },
      ]),
    ).toBe("check");
    expect(
      mapAnalysisStatus("in_review", [
        { decision: "approved", reviewerRole: "checker" },
        { decision: "pending", reviewerRole: "approver" },
      ]),
    ).toBe("ready");
  });
});

describe("buildAnalysisRecords", () => {
  it("maps cases, repair context, and the analyst's name", () => {
    const snapshot: TenantSnapshot = {
      ...emptySnapshot(),
      issues: [
        {
          id: "issue-1",
          code: "IS-1",
          zone: "Keel",
          description: "Crack",
          stage: "analysis",
          discoveredAt: "2026-10-02",
          locationLabel: "visual",
          assetId: "asset-1",
          assetIdentifier: "CR-2",
          assetOutOfService: false,
          reporterName: null,
          transitions: [],
          activity: [
            {
              at: "2026-10-06T11:00:00.000Z",
              message: "Blake updated the stack-up",
              entityId: "analysis-1",
            },
          ],
          repairs: [
            {
              id: "repair-1",
              code: "RD-1",
              title: "Splice",
              type: "splice",
              createdAt: "2026-10-02T00:00:00.000Z",
              revisions: [
                {
                  rev: "A",
                  detail: "two rows",
                  createdAt: "2026-10-02T00:00:00.000Z",
                  analyses: [
                    {
                      id: "analysis-1",
                      code: "AN-1",
                      title: "Keel splice",
                      method: "hand calc",
                      status: "in_progress",
                      dueDate: "2026-11-01",
                      createdAt: "2026-10-03T00:00:00.000Z",
                      updatedAt: "2026-10-03T00:00:00.000Z",
                      owner: { name: "Blake Ortiz", initials: "BO" },
                      cases: [
                        { name: "Net tension", margin: 0.12 },
                        { name: "Shear", margin: 0.4 },
                      ],
                      people: [
                        {
                          userId: "user-1",
                          name: "Blake Ortiz",
                          initials: "BO",
                          role: "analyst",
                        },
                      ],
                      reviews: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const now = new Date("2026-10-06T12:00:00.000Z");
    const [record] = buildAnalysisRecords(snapshot, now);

    expect(record).toMatchObject({
      id: "AN-1",
      identifier: "CR-2",
      zone: "Keel",
      status: "work",
      analyst: "BO",
      dueOn: "2026-11-01",
      repair: { id: "RD-1", revision: "A", detail: "two rows" },
      issue: { id: "IS-1", found: "Found Oct 2 · visual" },
      catalogOrder: 0,
    });
    expect(record?.cases.map((entry) => entry.margin)).toEqual([0.12, 0.4]);
    expect(record?.roster?.analyst.name).toBe("Blake Ortiz");
    expect(record?.log[0]?.text).toBe("Blake updated the stack-up");
  });
});

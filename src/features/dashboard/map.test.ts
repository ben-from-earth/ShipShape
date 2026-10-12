import { describe, expect, it } from "vitest";

import {
  emptySnapshot,
  type SnapshotIssue,
  type TenantSnapshot,
} from "@/db/snapshot";

import { buildDashboardModel, discoveredOn } from "./map";

const AS_OF = "2026-10-06";

function issue(
  overrides: Partial<SnapshotIssue> &
    Pick<SnapshotIssue, "id" | "code" | "stage">,
): SnapshotIssue {
  return {
    zone: "Tail",
    description: overrides.code,
    discoveredAt: AS_OF,
    locationLabel: null,
    assetId: "asset-1",
    assetIdentifier: "CR-2",
    assetOutOfService: false,
    reporterName: null,
    transitions: [],
    repairs: [],
    activity: [],
    ...overrides,
  };
}

describe("discoveredOn", () => {
  it("uses the first stage transition instead of discovered_at", () => {
    const row = issue({
      id: "issue-1",
      code: "IS-1",
      stage: "discovered",
      discoveredAt: AS_OF,
      transitions: [{ at: "2026-08-27T00:00:00.000Z", toStage: "discovered" }],
    });

    expect(discoveredOn(row)).toBe("2026-08-27");
  });
});

describe("buildDashboardModel", () => {
  it("counts the current stage, ages from transitions, and groups zones", () => {
    const snapshot: TenantSnapshot = {
      ...emptySnapshot(),
      threshold: 0.25,
      assetGroupName: "Yard cranes",
      assets: [
        { id: "asset-1", identifier: "CR-1", outOfService: true },
        { id: "asset-2", identifier: "CR-2", outOfService: false },
      ],
      issues: [
        issue({
          id: "old",
          code: "IS-OLD",
          stage: "discovered",
          assetId: "asset-1",
          assetIdentifier: "CR-1",
          assetOutOfService: true,
          zone: "Tail",
          transitions: [
            { at: "2026-08-27T00:00:00.000Z", toStage: "discovered" },
          ],
          activity: [
            {
              at: "2026-09-01T00:00:00.000Z",
              message: "Waiting on supplier repair data",
              entityId: "old",
            },
          ],
        }),
        issue({
          id: "wing",
          code: "IS-WING",
          stage: "analysis",
          zone: "Wing",
          transitions: [
            { at: "2026-10-04T00:00:00.000Z", toStage: "discovered" },
            { at: "2026-10-05T00:00:00.000Z", toStage: "analysis" },
          ],
          repairs: [
            {
              id: "repair-1",
              code: "RD-1",
              title: "Patch",
              type: "patch",
              createdAt: "2026-10-05T00:00:00.000Z",
              revisions: [
                {
                  rev: "A",
                  detail: null,
                  createdAt: "2026-10-05T00:00:00.000Z",
                  analyses: [
                    {
                      id: "analysis-1",
                      code: "AN-1",
                      title: "Wing patch",
                      method: null,
                      status: "changes_requested",
                      dueDate: "2026-10-01",
                      createdAt: "2026-10-05T00:00:00.000Z",
                      updatedAt: "2026-10-05T00:00:00.000Z",
                      owner: null,
                      cases: [{ name: "Bearing", margin: -0.05 }],
                      people: [],
                      reviews: [],
                    },
                  ],
                },
              ],
            },
          ],
        }),
        issue({
          id: "closed",
          code: "IS-CLOSED",
          stage: "approved",
          zone: "Tail",
          transitions: [
            { at: "2026-09-20T00:00:00.000Z", toStage: "discovered" },
            { at: "2026-10-05T15:00:00.000Z", toStage: "approved" },
          ],
        }),
      ],
    };

    const model = buildDashboardModel(snapshot, "30D", AS_OF);

    expect(model.asOfLabel).toBe("Oct 6, 2026");
    expect(model.assetGroupName).toBe("Yard cranes");
    expect(model.pipeline.map((stage) => stage.count)).toEqual([1, 0, 1, 0]);
    expect(model.zones.map((zone) => [zone.name, zone.count])).toEqual([
      ["Tail", 1],
      ["Wing", 1],
    ]);
    expect(model.aging.find((bucket) => bucket.id === "30+")?.count).toBe(1);
    expect(model.agingNote).toBe(
      "1 items older than 30 days — 1 are waiting on supplier repair data.",
    );
    expect(model.attention.map((row) => [row.id, row.flag])).toEqual([
      ["AN-1", "negative-margin"],
      ["IS-OLD", "asset-down"],
    ]);
    expect(model.attention[1]?.stageLabel).toBe("Issue");
    expect(model.attention[0]?.stageLabel).toBe("Analyze · Rework");
    expect(model.kpis.find((kpi) => kpi.label === "Open items")).toMatchObject({
      value: "2",
    });
    expect(model.kpis.find((kpi) => kpi.label === "Assets down")).toMatchObject(
      {
        value: "1",
        unit: "of 2",
        delta: "CR-1",
      },
    );
    const last = model.throughput[model.throughput.length - 1];
    expect(last).toMatchObject({ opened: 0, approved: 1 });
  });
});

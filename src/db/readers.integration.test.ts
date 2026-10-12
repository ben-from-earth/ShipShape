import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { readAnalyses } from "@/features/analyses/db";
import { readDashboard } from "@/features/dashboard/db";
import { readLowMarginThreshold } from "@/lib/org-threshold";

import type { Database } from "./index";
import {
  emptyDatabase,
  isLoopbackDatabaseUrl,
  openIntegrationDatabase,
} from "./integration";
import {
  activityLog,
  analyses,
  analysisCases,
  analysisPeople,
  assetGroups,
  assets,
  issues,
  organizations,
  repairRevisions,
  repairs,
  reviews,
  stageTransitions,
  users,
} from "./schema";

const AS_OF = "2026-10-06";
const enabled = process.env.RUN_DB_INTEGRATION === "1";

function uid(n: number): string {
  return `20000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

function at(day: string, time = "12:00:00"): Date {
  return new Date(`${day}T${time}.000Z`);
}

describe.skipIf(!enabled)("database-backed readers", () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || !isLoopbackDatabaseUrl(databaseUrl)) {
      throw new Error(
        "RUN_DB_INTEGRATION requires a localhost DATABASE_URL. Neon is never used.",
      );
    }

    const opened = await openIntegrationDatabase(databaseUrl);
    db = opened.db;
    close = opened.close;
  }, 60_000);

  afterAll(async () => {
    if (close) {
      await close();
    }
  });

  beforeEach(async () => {
    await emptyDatabase(db);
  });

  it("falls back to 0.10 and an empty dashboard when nothing is seeded", async () => {
    expect(await readLowMarginThreshold(db)).toBe(0.1);

    const dashboard = await readDashboard(db, "30D", AS_OF);
    expect(
      dashboard.kpis.find((kpi) => kpi.label === "Open items")?.value,
    ).toBe("0");
    expect(await readAnalyses(db, at(AS_OF))).toEqual([]);
  });

  it("scopes pipeline, age, zones, throughput, and analyses through assets.org_id", async () => {
    const orgA = uid(1);
    const orgB = uid(2);
    const analyst = uid(11);
    const checker = uid(12);
    const approver = uid(13);
    const group = uid(21);
    const assetDown = uid(31);
    const assetUp = uid(32);
    const otherAsset = uid(41);

    await db.insert(organizations).values([
      {
        id: orgA,
        name: "North Yard",
        lowMarginThreshold: "0.25",
        createdAt: at("2026-01-01"),
      },
      {
        id: orgB,
        name: "Other Yard",
        lowMarginThreshold: "0.99",
        createdAt: at("2026-06-01"),
      },
    ]);
    await db.insert(users).values([
      {
        id: analyst,
        orgId: orgA,
        email: "blake@example.com",
        name: "Blake Ortiz",
        initials: "BO",
        role: "analyst",
      },
      {
        id: checker,
        orgId: orgA,
        email: "casey@example.com",
        name: "Casey Nguyen",
        initials: "CN",
        role: "checker",
      },
      {
        id: approver,
        orgId: orgA,
        email: "drew@example.com",
        name: "Drew Patel",
        initials: "DP",
        role: "approver",
      },
    ]);
    await db.insert(assetGroups).values({
      id: group,
      orgId: orgA,
      name: "Yard cranes",
    });
    await db.insert(assets).values([
      {
        id: assetDown,
        orgId: orgA,
        groupId: group,
        identifier: "CR-1",
        outOfService: true,
      },
      {
        id: assetUp,
        orgId: orgA,
        groupId: group,
        identifier: "CR-2",
        outOfService: false,
      },
      {
        id: otherAsset,
        orgId: orgB,
        identifier: "OTHER",
        outOfService: true,
      },
    ]);

    const issueOld = uid(101);
    const issueRepair = uid(102);
    const issueRework = uid(103);
    const issueReview = uid(104);
    const issueLow = uid(105);
    const issueApproved = uid(106);
    const issueOther = uid(201);

    await db.insert(issues).values([
      {
        id: issueOld,
        code: "IS-1",
        assetId: assetDown,
        zone: "Tail",
        description: "Old crack",
        stage: "discovered",
        discoveredAt: at(AS_OF),
      },
      {
        id: issueRepair,
        code: "IS-2",
        assetId: assetUp,
        zone: "Tail",
        description: "Repair defined",
        stage: "repair_defined",
        discoveredAt: at("2026-10-03"),
      },
      {
        id: issueRework,
        code: "IS-3",
        assetId: assetUp,
        zone: "Wing",
        description: "Negative margin",
        stage: "analysis",
        locationLabel: "visual",
        discoveredAt: at("2026-10-02"),
      },
      {
        id: issueReview,
        code: "IS-4",
        assetId: assetUp,
        zone: "Wing",
        description: "In review",
        stage: "review",
        discoveredAt: at("2026-10-04"),
      },
      {
        id: issueLow,
        code: "IS-5",
        assetId: assetUp,
        zone: "Keel",
        description: "Low margin",
        stage: "analysis",
        discoveredAt: at("2026-10-05"),
      },
      {
        id: issueApproved,
        code: "IS-6",
        assetId: assetUp,
        zone: "Nose",
        description: "Approved",
        stage: "approved",
        discoveredAt: at("2026-09-20"),
      },
      {
        id: issueOther,
        code: "IS-B",
        assetId: otherAsset,
        zone: "Tail",
        description: "Other tenant",
        stage: "discovered",
        discoveredAt: at("2026-08-01"),
      },
    ]);

    await db.insert(stageTransitions).values([
      {
        id: uid(301),
        issueId: issueOld,
        fromStage: null,
        toStage: "discovered",
        changedAt: at("2026-08-27"),
      },
      {
        id: uid(302),
        issueId: issueRepair,
        fromStage: null,
        toStage: "discovered",
        changedAt: at("2026-10-03"),
      },
      {
        id: uid(303),
        issueId: issueRepair,
        fromStage: "discovered",
        toStage: "repair_defined",
        changedAt: at("2026-10-04"),
      },
      {
        id: uid(304),
        issueId: issueRework,
        fromStage: null,
        toStage: "discovered",
        changedAt: at("2026-10-04"),
      },
      {
        id: uid(305),
        issueId: issueRework,
        fromStage: "discovered",
        toStage: "analysis",
        changedAt: at("2026-10-05", "08:00:00"),
      },
      {
        id: uid(306),
        issueId: issueReview,
        fromStage: null,
        toStage: "discovered",
        changedAt: at("2026-10-04"),
      },
      {
        id: uid(307),
        issueId: issueReview,
        fromStage: "analysis",
        toStage: "review",
        changedAt: at("2026-10-05", "09:00:00"),
      },
      {
        id: uid(308),
        issueId: issueLow,
        fromStage: null,
        toStage: "discovered",
        changedAt: at("2026-10-05"),
      },
      {
        id: uid(309),
        issueId: issueLow,
        fromStage: "discovered",
        toStage: "analysis",
        changedAt: at("2026-10-05", "18:00:00"),
      },
      {
        id: uid(310),
        issueId: issueApproved,
        fromStage: null,
        toStage: "discovered",
        changedAt: at("2026-09-20"),
      },
      {
        id: uid(311),
        issueId: issueApproved,
        fromStage: "review",
        toStage: "approved",
        changedAt: at("2026-10-05", "15:00:00"),
      },
      {
        id: uid(312),
        issueId: issueOther,
        fromStage: null,
        toStage: "discovered",
        changedAt: at("2026-08-01"),
      },
    ]);

    const repairOld = uid(401);
    const repairRework = uid(403);
    const repairReview = uid(404);
    const repairLow = uid(405);
    const repairApproved = uid(406);
    const repairOther = uid(407);

    await db.insert(repairs).values([
      {
        id: repairOld,
        code: "RD-2",
        issueId: issueRepair,
        title: "Defined repair",
        type: "doubler",
      },
      {
        id: repairRework,
        code: "RD-3",
        issueId: issueRework,
        title: "Rework fitting",
        type: "fitting",
      },
      {
        id: repairReview,
        code: "RD-4",
        issueId: issueReview,
        title: "Review patch",
        type: "patch",
      },
      {
        id: repairLow,
        code: "RD-5",
        issueId: issueLow,
        title: "Low splice",
        type: "splice",
      },
      {
        id: repairApproved,
        code: "RD-6",
        issueId: issueApproved,
        title: "Released repair",
        type: "doubler",
      },
      {
        id: repairOther,
        code: "RD-B",
        issueId: issueOther,
        title: "Other repair",
        type: "doubler",
      },
    ]);

    const revRework = uid(503);
    const revReview = uid(504);
    const revLow = uid(505);
    const revApproved = uid(506);
    const revOther = uid(507);
    const revDefined = uid(502);

    await db.insert(repairRevisions).values([
      { id: revDefined, repairId: repairOld, rev: "A", detail: "defined" },
      {
        id: revRework,
        repairId: repairRework,
        rev: "B",
        detail: "two rows",
      },
      { id: revReview, repairId: repairReview, rev: "A", detail: "checked" },
      { id: revLow, repairId: repairLow, rev: "A", detail: "splice" },
      {
        id: revApproved,
        repairId: repairApproved,
        rev: "C",
        detail: "released",
      },
      { id: revOther, repairId: repairOther, rev: "A", detail: "other" },
    ]);

    const analysisRework = uid(603);
    const analysisReview = uid(604);
    const analysisLow = uid(605);
    const analysisApproved = uid(606);
    const analysisOther = uid(607);

    await db.insert(analyses).values([
      {
        id: analysisRework,
        code: "AN-3",
        repairRevisionId: revRework,
        title: "Rework fitting",
        method: "hand calc",
        status: "changes_requested",
        ownerId: analyst,
        dueDate: "2026-10-01",
        createdAt: at("2026-10-01"),
        updatedAt: at("2026-10-05"),
      },
      {
        id: analysisReview,
        code: "AN-4",
        repairRevisionId: revReview,
        title: "Ready patch",
        method: "layer loads",
        status: "in_review",
        ownerId: analyst,
        dueDate: "2026-10-07",
        createdAt: at("2026-10-02"),
        updatedAt: at("2026-10-05"),
      },
      {
        id: analysisLow,
        code: "AN-5",
        repairRevisionId: revLow,
        title: "Low splice",
        method: "hand calc",
        status: "in_progress",
        ownerId: analyst,
        dueDate: "2026-11-01",
        createdAt: at("2026-10-03"),
        updatedAt: at("2026-10-05"),
      },
      {
        id: analysisApproved,
        code: "AN-6",
        repairRevisionId: revApproved,
        title: "Released repair",
        method: "layer loads",
        status: "approved",
        ownerId: analyst,
        dueDate: "2026-10-04",
        createdAt: at("2026-10-04"),
        updatedAt: at("2026-10-05", "15:00:00"),
      },
      {
        id: analysisOther,
        code: "AN-B",
        repairRevisionId: revOther,
        title: "Other analysis",
        status: "draft",
        createdAt: at("2026-08-02"),
        updatedAt: at("2026-08-02"),
      },
    ]);

    await db.insert(analysisCases).values([
      {
        id: uid(703),
        analysisId: analysisRework,
        name: "Lug bearing",
        margin: "-0.050",
      },
      {
        id: uid(704),
        analysisId: analysisRework,
        name: "Bolt shear",
        margin: "0.200",
      },
      {
        id: uid(705),
        analysisId: analysisReview,
        name: "Net section",
        margin: "0.300",
      },
      {
        id: uid(706),
        analysisId: analysisLow,
        name: "Net tension",
        margin: "0.120",
      },
      {
        id: uid(707),
        analysisId: analysisApproved,
        name: "Bearing",
        margin: "0.400",
      },
    ]);

    await db.insert(analysisPeople).values([
      { analysisId: analysisRework, userId: analyst, role: "analyst" },
      { analysisId: analysisReview, userId: analyst, role: "analyst" },
      { analysisId: analysisReview, userId: checker, role: "checker" },
      { analysisId: analysisReview, userId: approver, role: "approver" },
      { analysisId: analysisLow, userId: analyst, role: "analyst" },
      { analysisId: analysisApproved, userId: analyst, role: "analyst" },
    ]);

    await db.insert(reviews).values([
      {
        id: uid(801),
        analysisId: analysisReview,
        reviewerId: checker,
        decision: "approved",
        decidedAt: at("2026-10-05", "10:00:00"),
      },
      {
        id: uid(802),
        analysisId: analysisReview,
        reviewerId: approver,
        decision: "pending",
      },
    ]);

    await db.insert(activityLog).values({
      id: uid(901),
      orgId: orgA,
      entityType: "issue",
      entityId: issueOld,
      message: "Waiting on supplier repair data",
      createdAt: at("2026-09-01"),
    });

    expect(await readLowMarginThreshold(db)).toBe(0.25);

    const dashboard = await readDashboard(db, "30D", AS_OF);

    expect(dashboard.assetGroupName).toBe("Yard cranes");
    expect(dashboard.pipeline.map((stage) => stage.count)).toEqual([
      1, 1, 2, 1,
    ]);
    expect(dashboard.zones.map((zone) => [zone.name, zone.count])).toEqual([
      ["Tail", 2],
      ["Wing", 2],
      ["Keel", 1],
    ]);
    expect(dashboard.zones[0]?.highlighted).toBe(true);
    expect(dashboard.aging.find((bucket) => bucket.id === "30+")?.count).toBe(
      1,
    );
    expect(dashboard.agingNote).toBe(
      "1 items older than 30 days — 1 are waiting on supplier repair data.",
    );
    expect(dashboard.throughput.at(-1)).toMatchObject({
      opened: 1,
      approved: 1,
    });
    expect(dashboard.attention.map((row) => [row.id, row.flag])).toEqual([
      ["AN-3", "negative-margin"],
      ["IS-1", "asset-down"],
      ["AN-4", "due-tomorrow"],
      ["AN-5", "low-margin"],
    ]);
    expect(dashboard.attention[0]?.stageLabel).toBe("Analyze · Rework");
    expect(dashboard.kpis.map((kpi) => [kpi.label, kpi.value])).toEqual([
      ["Open items", "5"],
      ["Median cycle time", "15.0"],
      ["Awaiting approval", "1"],
      ["First-pass check", "100"],
      ["Overdue", "1"],
      ["Assets down", "1"],
    ]);
    expect(
      dashboard.kpis.find((kpi) => kpi.label === "Open items")?.delta,
    ).toBe("+4 vs prior");
    expect(
      dashboard.kpis.find((kpi) => kpi.label === "Assets down"),
    ).toMatchObject({ unit: "of 2", delta: "CR-1" });
    expect(
      dashboard.engineers.map((person) => [person.initials, person.total]),
    ).toEqual([
      ["BO", 3],
      ["CN", 1],
      ["DP", 1],
    ]);

    const records = await readAnalyses(db, at(AS_OF));
    expect(records.map((record) => record.id)).toEqual([
      "AN-3",
      "AN-4",
      "AN-5",
      "AN-6",
    ]);
    expect(records.map((record) => record.status)).toEqual([
      "rework",
      "ready",
      "work",
      "done",
    ]);
    expect(records[0]).toMatchObject({
      identifier: "CR-2",
      zone: "Wing",
      analyst: "BO",
      repair: { id: "RD-3", revision: "B", detail: "two rows" },
      issue: { id: "IS-3", found: "Found Oct 2 · visual" },
    });
    expect(records[0]?.cases.map((entry) => entry.margin).sort()).toEqual([
      -0.05, 0.2,
    ]);
    expect(records[0]?.roster?.analyst.name).toBe("Blake Ortiz");
    expect(records[1]?.checker).toBe("CN");
    expect(records[1]?.approver).toBe("DP");
  });
});

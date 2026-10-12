import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/db";
import {
  emptyDatabase,
  isLoopbackDatabaseUrl,
  openIntegrationDatabase,
} from "@/db/integration";
import {
  assets,
  issues,
  organizations,
  stageTransitions,
  users,
} from "@/db/schema";

import { advanceStage, applyStageAdvance } from "./advance-stage";

/**
 * Stage advances against the migrated CI database.
 * `RUN_DB_INTEGRATION=1` selects it. The host must be loopback.
 */

const enabled = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!enabled)("advanceStage", () => {
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

  it("writes the forward stage and one history row", async () => {
    const org = uid(1);
    const finding = uid(2);
    const asset = uid(3);
    const actor = uid(4);
    await seedFinding(db, { org, finding, asset, actor });

    const result = await advanceStage(
      {
        orgId: org,
        findingId: finding,
        toStage: "repair_defined",
        actorId: actor,
      },
      db,
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      return;
    }
    expect(result).toMatchObject({
      id: finding,
      stage: "repair_defined",
    });
    expect(new Date(result.transitionedAt).toISOString()).toBe(
      result.transitionedAt,
    );

    const stored = await db
      .select({ stage: issues.stage, updatedAt: issues.updatedAt })
      .from(issues)
      .where(eq(issues.id, finding));
    expect(stored[0]?.stage).toBe("repair_defined");
    expect(stored[0]?.updatedAt.getTime()).toBeGreaterThan(
      new Date("2020-01-01T00:00:00.000Z").getTime(),
    );

    const history = await historyFor(db, finding);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromStage: "discovered",
      toStage: "repair_defined",
      changedBy: actor,
    });
    expect(result.transitionedAt).toBe(history[0]?.changedAt.toISOString());

    const again = await advanceStage(
      {
        orgId: org,
        findingId: finding,
        toStage: "repair_defined",
        actorId: actor,
      },
      db,
    );
    expect(again).toEqual({ kind: "invalid_transition" });
    expect(await historyFor(db, finding)).toHaveLength(1);
  });

  it("allows the rework send-backs", async () => {
    const org = uid(1);
    const actor = uid(2);
    const analysisFinding = uid(3);
    const reviewFinding = uid(4);
    await seedFinding(db, {
      org,
      finding: analysisFinding,
      asset: uid(5),
      actor,
      stage: "analysis",
    });
    await seedFinding(db, {
      org,
      finding: reviewFinding,
      asset: uid(6),
      actor,
      stage: "review",
      code: "FND-REVIEW",
    });

    const backToRepair = await advanceStage(
      {
        orgId: org,
        findingId: analysisFinding,
        toStage: "repair_defined",
        actorId: actor,
      },
      db,
    );
    const backToAnalysis = await advanceStage(
      {
        orgId: org,
        findingId: reviewFinding,
        toStage: "analysis",
        actorId: actor,
      },
      db,
    );

    expect(backToRepair).toMatchObject({
      kind: "ok",
      id: analysisFinding,
      stage: "repair_defined",
    });
    expect(backToAnalysis).toMatchObject({
      kind: "ok",
      id: reviewFinding,
      stage: "analysis",
    });
    if (backToRepair.kind === "ok") {
      expect(backToRepair.transitionedAt).toBe(
        (await historyFor(db, analysisFinding))[0]?.changedAt.toISOString(),
      );
    }
    if (backToAnalysis.kind === "ok") {
      expect(backToAnalysis.transitionedAt).toBe(
        (await historyFor(db, reviewFinding))[0]?.changedAt.toISOString(),
      );
    }
    expect(await historyFor(db, analysisFinding)).toHaveLength(1);
    expect(await historyFor(db, reviewFinding)).toHaveLength(1);
  });

  it("rejects a skipped stage and does not write", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    await seedFinding(db, { org, finding, asset: uid(4), actor });

    const result = await advanceStage(
      { orgId: org, findingId: finding, toStage: "review", actorId: actor },
      db,
    );

    expect(result).toEqual({ kind: "invalid_transition" });
    expect(await stageOf(db, finding)).toBe("discovered");
    expect(await historyFor(db, finding)).toEqual([]);
  });

  it("rejects the same stage and an unknown stage", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    await seedFinding(db, { org, finding, asset: uid(4), actor });

    const same = await advanceStage(
      {
        orgId: org,
        findingId: finding,
        toStage: "discovered",
        actorId: actor,
      },
      db,
    );
    const unknown = await advanceStage(
      { orgId: org, findingId: finding, toStage: "published", actorId: actor },
      db,
    );

    expect(same).toEqual({ kind: "invalid_transition" });
    expect(unknown).toEqual({ kind: "invalid_transition" });
    expect(await stageOf(db, finding)).toBe("discovered");
    expect(await historyFor(db, finding)).toEqual([]);
  });

  it("returns not_found for another organization and does not write", async () => {
    const org = uid(1);
    const otherOrg = uid(2);
    const finding = uid(3);
    const actor = uid(4);
    await seedFinding(db, { org, finding, asset: uid(5), actor });
    await db.insert(organizations).values({
      id: otherOrg,
      name: "Other yard",
    });

    const result = await advanceStage(
      {
        orgId: otherOrg,
        findingId: finding,
        toStage: "repair_defined",
        actorId: actor,
      },
      db,
    );
    const guarded = await applyStageAdvance(db, {
      orgId: otherOrg,
      findingId: finding,
      fromStage: "discovered",
      toStage: "repair_defined",
      actorId: actor,
    });

    expect(result).toEqual({ kind: "not_found" });
    expect(guarded).toEqual({ kind: "not_found" });
    expect(await stageOf(db, finding)).toBe("discovered");
    expect(await historyFor(db, finding)).toEqual([]);
  });

  it("treats a stale expected stage as a conflict and writes no history", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    await seedFinding(db, {
      org,
      finding,
      asset: uid(4),
      actor,
      stage: "analysis",
    });

    const result = await applyStageAdvance(db, {
      orgId: org,
      findingId: finding,
      fromStage: "discovered",
      toStage: "repair_defined",
      actorId: actor,
    });

    expect(result).toEqual({ kind: "conflict" });
    expect(await stageOf(db, finding)).toBe("analysis");
    expect(await historyFor(db, finding)).toEqual([]);
  });

  it("lets one of two concurrent writes win and records a single transition", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    await seedFinding(db, { org, finding, asset: uid(4), actor });
    const input = {
      orgId: org,
      findingId: finding,
      fromStage: "discovered" as const,
      toStage: "repair_defined" as const,
      actorId: actor,
    };

    const results = await Promise.all([
      applyStageAdvance(db, input),
      applyStageAdvance(db, input),
    ]);

    expect(results.map((result) => result.kind).sort()).toEqual([
      "conflict",
      "ok",
    ]);
    expect(await stageOf(db, finding)).toBe("repair_defined");
    expect(await historyFor(db, finding)).toHaveLength(1);
  });

  it("rolls the stage change back when the actor does not exist", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    await seedFinding(db, { org, finding, asset: uid(4), actor });

    await expect(
      advanceStage(
        {
          orgId: org,
          findingId: finding,
          toStage: "repair_defined",
          actorId: randomUUID(),
        },
        db,
      ),
    ).rejects.toThrow();

    expect(await stageOf(db, finding)).toBe("discovered");
    expect(await historyFor(db, finding)).toEqual([]);
  });
});

const INTEGRATION_ID_PREFIX = "61000000-0000-4000-8000-";

function uid(n: number): string {
  return `${INTEGRATION_ID_PREFIX}${n.toString(16).padStart(12, "0")}`;
}

async function seedFinding(
  db: Database,
  input: {
    org: string;
    finding: string;
    asset: string;
    actor: string;
    stage?: "discovered" | "analysis" | "review";
    code?: string;
  },
): Promise<void> {
  const existingOrg = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, input.org));
  if (!existingOrg[0]) {
    await db.insert(organizations).values({
      id: input.org,
      name: "Harbor Yard",
    });
  }

  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, input.actor));
  if (!existingUser[0]) {
    await db.insert(users).values({
      id: input.actor,
      orgId: input.org,
      email: `${input.actor}@example.com`,
      name: "Ada Actor",
      initials: "AA",
      role: "analyst",
    });
  }

  await db.insert(assets).values({
    id: input.asset,
    orgId: input.org,
    identifier: `A-${input.asset.slice(-4)}`,
    name: "Canopy sill",
  });
  await db.insert(issues).values({
    id: input.finding,
    code: input.code ?? `FND-${input.finding.slice(-4)}`,
    assetId: input.asset,
    description: "Skin crack at the canopy sill.",
    severity: "high",
    stage: input.stage ?? "discovered",
    updatedAt: new Date("2020-01-01T00:00:00.000Z"),
  });
}

async function stageOf(
  db: Database,
  findingId: string,
): Promise<string | undefined> {
  const rows = await db
    .select({ stage: issues.stage })
    .from(issues)
    .where(eq(issues.id, findingId));
  return rows[0]?.stage;
}

async function historyFor(db: Database, findingId: string) {
  return db
    .select()
    .from(stageTransitions)
    .where(eq(stageTransitions.issueId, findingId));
}

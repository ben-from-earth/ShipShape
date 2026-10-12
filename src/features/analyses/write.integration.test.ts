import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { LOW_MARGIN_THRESHOLD } from "@/config/analysis";
import type { Database } from "@/db";
import { formatAnalysisCode, nextAnalysisCode } from "@/db/analysis-code";
import {
  emptyDatabase,
  isLoopbackDatabaseUrl,
  openIntegrationDatabase,
} from "@/db/integration";
import { readLowMarginThreshold } from "@/lib/org-threshold";
import { classifyMargin } from "@/lib/margin";
import { readAnalyses } from "@/features/analyses/db";
import { readDashboard } from "@/features/dashboard/db";
import {
  analyses,
  assets,
  issues,
  organizations,
  repairRevisions,
  repairs,
  stageTransitions,
  users,
} from "@/db/schema";

import { createAnalysis, getAnalysis } from "./data";

/**
 * Analysis writes against the migrated CI database.
 * `RUN_DB_INTEGRATION=1` selects it. The host must be loopback.
 */

const enabled = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!enabled)("analyses writes", () => {
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

  it("creates an AN- code, reuses the revision, and stays in the organization", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    const repair = uid(5);
    await seedRepair(db, { org, finding, asset: uid(4), actor, repair });

    const result = await createAnalysis(
      {
        orgId: org,
        repairId: repair,
        actorId: actor,
        title: "Limit check",
        method: "hand calc",
        loadCase: "Limit load",
        margin: 0.25,
        dueDate: "2026-12-01",
      },
      db,
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      return;
    }
    expect(result.analysis).toMatchObject({
      repairId: repair,
      revision: "A",
      title: "Limit check",
      method: "hand calc",
      loadCase: "Limit load",
      status: "draft",
      createdBy: actor,
      dueDate: "2026-12-01",
    });
    expect(result.analysis.margin).toBeCloseTo(0.25, 5);
    expect(result.analysis.code).toMatch(/^AN-\d{4,}$/);
    const number = BigInt(result.analysis.code.slice("AN-".length));
    expect(result.analysis.code).toBe(formatAnalysisCode(number));
    expect(new Date(result.analysis.createdAt).toISOString()).toBe(
      result.analysis.createdAt,
    );

    const again = await createAnalysis(
      {
        orgId: org,
        repairId: repair,
        actorId: actor,
        title: "Second case set",
        margin: 0.4,
      },
      db,
    );
    expect(again).toMatchObject({
      kind: "ok",
      analysis: { revisionId: result.analysis.revisionId, revision: "A" },
    });
    expect(await revisionCount(db, repair)).toBe(1);
    expect(await stageOf(db, finding)).toBe("discovered");
    const history = await db
      .select({ id: stageTransitions.id })
      .from(stageTransitions)
      .where(eq(stageTransitions.issueId, finding));
    expect(history).toEqual([]);

    const loaded = await getAnalysis(org, result.analysis.id, db);
    expect(loaded).toEqual(result.analysis);
    expect(await getAnalysis(uid(9), result.analysis.id, db)).toBeNull();
    expect(await getAnalysis(org, randomUUID(), db)).toBeNull();
  });

  it("gives concurrent creates distinct codes", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    const repair = uid(5);
    await seedRepair(db, { org, finding, asset: uid(4), actor, repair });
    await db.insert(repairRevisions).values({
      id: uid(6),
      repairId: repair,
      rev: "A",
      createdBy: actor,
    });

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        createAnalysis(
          {
            orgId: org,
            repairId: repair,
            actorId: actor,
            title: `Case ${index}`,
            margin: 0.2,
          },
          db,
        ),
      ),
    );

    const codes = results.map((result) => {
      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") {
        throw new Error("expected an analysis");
      }
      return result.analysis.code;
    });
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^AN-\d{4,}$/);
      expect(code).toBe(formatAnalysisCode(BigInt(code.slice("AN-".length))));
    }
    expect(await revisionCount(db, repair)).toBe(1);
    expect(await stageOf(db, finding)).toBe("discovered");
  });

  it("returns not_found for another organization and does not consume a code", async () => {
    const org = uid(1);
    const other = uid(2);
    const finding = uid(3);
    const actor = uid(4);
    const repair = uid(6);
    await seedRepair(db, { org, finding, asset: uid(5), actor, repair });
    await db.insert(organizations).values({ id: other, name: "Other yard" });

    const before = await nextAnalysisCode(db);
    const result = await createAnalysis(
      {
        orgId: other,
        repairId: repair,
        actorId: actor,
        title: "Should not persist",
        margin: 0.1,
      },
      db,
    );
    const after = await nextAnalysisCode(db);

    expect(result).toEqual({ kind: "not_found" });
    expect(
      await createAnalysis(
        {
          orgId: org,
          repairId: randomUUID(),
          actorId: actor,
          title: "Missing repair",
          margin: 0.1,
        },
        db,
      ),
    ).toEqual({ kind: "not_found" });
    const stored = await db.select({ id: analyses.id }).from(analyses);
    expect(stored).toEqual([]);
    expect(await revisionCount(db, repair)).toBe(0);
    expect(codeNumber(after)).toBe(codeNumber(before) + BigInt(1));
    expect(await stageOf(db, finding)).toBe("discovered");
  });

  it("stores null when actorId is null", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    const repair = uid(5);
    await seedRepair(db, { org, finding, asset: uid(4), actor, repair });

    const result = await createAnalysis(
      {
        orgId: org,
        repairId: repair,
        actorId: null,
        title: "Opened before sessions exist",
        margin: 0.3,
      },
      db,
    );

    expect(result).toMatchObject({
      kind: "ok",
      analysis: { repairId: repair, createdBy: null, status: "draft" },
    });
    if (result.kind !== "ok") {
      return;
    }
    expect(await getAnalysis(org, result.analysis.id, db)).toMatchObject({
      createdBy: null,
    });
    const stored = await db
      .select({ createdBy: analyses.createdBy })
      .from(analyses)
      .where(eq(analyses.id, result.analysis.id));
    expect(stored[0]?.createdBy).toBeNull();
    const revision = await db
      .select({ createdBy: repairRevisions.createdBy })
      .from(repairRevisions)
      .where(eq(repairRevisions.repairId, repair));
    expect(revision[0]?.createdBy).toBeNull();
    expect(await stageOf(db, finding)).toBe("discovered");
  });

  it("rejects a non-uuid actor and rolls back when the user is missing", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    const repair = uid(5);
    await seedRepair(db, { org, finding, asset: uid(4), actor, repair });

    await expect(
      createAnalysis(
        {
          orgId: org,
          repairId: repair,
          actorId: "not-a-uuid",
          title: "Bad actor",
          margin: 0.1,
        },
        db,
      ),
    ).rejects.toThrow(/UUID/);

    await expect(
      createAnalysis(
        {
          orgId: org,
          repairId: repair,
          actorId: randomUUID(),
          title: "Missing actor",
          margin: 0.1,
        },
        db,
      ),
    ).rejects.toThrow();

    const stored = await db.select({ id: analyses.id }).from(analyses);
    expect(stored).toEqual([]);
    expect(await revisionCount(db, repair)).toBe(0);
    expect(await stageOf(db, finding)).toBe("discovered");
  });

  it("classifies a created margin through the existing readers", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    const repair = uid(5);
    await seedRepair(db, {
      org,
      finding,
      asset: uid(4),
      actor,
      repair,
      identifier: "FIT-1",
      discoveredAt: new Date("2026-10-01T00:00:00.000Z"),
    });

    const result = await createAnalysis(
      {
        orgId: org,
        repairId: repair,
        actorId: actor,
        title: "Limit check",
        method: "hand calc",
        loadCase: "Limit load",
        margin: 0.05,
      },
      db,
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      return;
    }

    const threshold = await readLowMarginThreshold(db);
    expect(threshold).toBe(LOW_MARGIN_THRESHOLD);

    const records = await readAnalyses(
      db,
      new Date("2026-10-12T00:00:00.000Z"),
    );
    expect(records.map((record) => record.id)).toEqual([result.analysis.code]);
    const margin = Math.min(
      ...(records[0]?.cases.map((entry) => entry.margin) ?? []),
    );
    expect(margin).toBeCloseTo(0.05, 5);
    expect(classifyMargin(margin, threshold)).toBe("low");

    const dashboard = await readDashboard(db, "30D", "2026-10-12");
    expect(dashboard.marginThreshold).toBe(LOW_MARGIN_THRESHOLD);
    expect(dashboard.attention).toHaveLength(1);
    expect(dashboard.attention[0]).toMatchObject({
      id: result.analysis.code,
      identifier: "FIT-1",
      flag: "low-margin",
    });
    expect(dashboard.attention[0]?.margin).toBeCloseTo(0.05, 5);
  });

  it("setval skips existing analysis codes", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    const repair = uid(5);
    const revision = uid(6);
    await seedRepair(db, { org, finding, asset: uid(4), actor, repair });
    await db.insert(repairRevisions).values({
      id: revision,
      repairId: repair,
      rev: "A",
    });
    await db.insert(analyses).values({
      id: uid(7),
      code: "AN-7",
      repairRevisionId: revision,
      title: "Below the floor",
    });

    await db.execute(migrationSetval());

    const floored = await createAnalysis(
      {
        orgId: org,
        repairId: repair,
        actorId: actor,
        title: "Floor code",
        margin: 0.2,
      },
      db,
    );
    expect(floored).toMatchObject({
      kind: "ok",
      analysis: { code: "AN-1002" },
    });

    await db.insert(analyses).values([
      {
        id: uid(8),
        code: "XYZ-1001",
        repairRevisionId: revision,
        title: "Older prefix",
      },
      {
        id: uid(9),
        code: "AN-4242",
        repairRevisionId: revision,
        title: "Higher code",
      },
      {
        id: uid(10),
        code: "legacy",
        repairRevisionId: revision,
        title: "Not prefix-digits",
      },
    ]);
    await db.execute(migrationSetval());

    const next = await createAnalysis(
      {
        orgId: org,
        repairId: repair,
        actorId: actor,
        title: "Next code",
        margin: 0.2,
      },
      db,
    );
    expect(next).toMatchObject({
      kind: "ok",
      analysis: { code: "AN-4243" },
    });
  });
});

const INTEGRATION_ID_PREFIX = "63000000-0000-4000-8000-";

function uid(n: number): string {
  return `${INTEGRATION_ID_PREFIX}${n.toString(16).padStart(12, "0")}`;
}

function codeNumber(code: string): bigint {
  return BigInt(code.slice("AN-".length));
}

function migrationSetval(): string {
  const sqlText = readFileSync(
    path.join(process.cwd(), "migrations", "0004_analysis_codes.sql"),
    "utf8",
  );
  const statement = sqlText
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .find((part) => /\bsetval\s*\(/i.test(part));
  if (statement === undefined) {
    throw new Error("0004_analysis_codes.sql is missing setval");
  }
  return statement;
}

async function seedRepair(
  db: Database,
  input: {
    org: string;
    finding: string;
    asset: string;
    actor: string;
    repair: string;
    identifier?: string;
    discoveredAt?: Date;
  },
): Promise<void> {
  await db.insert(organizations).values({
    id: input.org,
    name: "Harbor Yard",
  });
  await db.insert(users).values({
    id: input.actor,
    orgId: input.org,
    email: `${input.actor}@example.com`,
    name: "Ada Actor",
    initials: "AA",
    role: "analyst",
  });
  await db.insert(assets).values({
    id: input.asset,
    orgId: input.org,
    identifier: input.identifier ?? `A-${input.asset.slice(-4)}`,
    name: "Fitting",
  });
  await db.insert(issues).values({
    id: input.finding,
    code: `FND-${input.finding.slice(-4)}`,
    assetId: input.asset,
    description: "Cracked fitting.",
    severity: "high",
    stage: "discovered",
    discoveredAt: input.discoveredAt,
  });
  await db.insert(repairs).values({
    id: input.repair,
    code: `REP-${input.repair.slice(-4)}`,
    issueId: input.finding,
    title: "Patch the fitting",
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

async function revisionCount(db: Database, repairId: string): Promise<number> {
  const rows = await db
    .select({ id: repairRevisions.id })
    .from(repairRevisions)
    .where(eq(repairRevisions.repairId, repairId));
  return rows.length;
}

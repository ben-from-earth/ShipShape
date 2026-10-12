import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/db";
import {
  emptyDatabase,
  isLoopbackDatabaseUrl,
  openIntegrationDatabase,
} from "@/db/integration";
import { formatRepairCode, nextRepairCode } from "@/db/repair-code";
import {
  assets,
  issues,
  organizations,
  repairs,
  stageTransitions,
  users,
} from "@/db/schema";

import { createRepair, getRepair, listRepairs } from "./data";

/**
 * Repair writes against the migrated CI database.
 * `RUN_DB_INTEGRATION=1` selects it. The host must be loopback.
 */

const enabled = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!enabled)("repairs data", () => {
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

  it("creates a REP- code and leaves the finding stage alone", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    await seedFinding(db, { org, finding, asset: uid(4), actor });

    const result = await createRepair(
      {
        orgId: org,
        findingId: finding,
        actorId: actor,
        title: "Patch the cracked fitting",
        type: "patch",
      },
      db,
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") {
      return;
    }
    expect(result.repair).toMatchObject({
      findingId: finding,
      title: "Patch the cracked fitting",
      type: "patch",
      status: "open",
      createdBy: actor,
    });
    expect(result.repair.code).toMatch(/^REP-\d{4,}$/);
    const number = BigInt(result.repair.code.slice("REP-".length));
    expect(result.repair.code).toBe(formatRepairCode(number));
    expect(new Date(result.repair.createdAt).toISOString()).toBe(
      result.repair.createdAt,
    );

    expect(await stageOf(db, finding)).toBe("discovered");
    const history = await db
      .select({ id: stageTransitions.id })
      .from(stageTransitions)
      .where(eq(stageTransitions.issueId, finding));
    expect(history).toEqual([]);

    const loaded = await getRepair(org, result.repair.id, db);
    expect(loaded).toEqual(result.repair);
    expect(await getRepair(uid(9), result.repair.id, db)).toBeNull();
    expect(await getRepair(org, randomUUID(), db)).toBeNull();
  });

  it("gives concurrent creates distinct codes", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    await seedFinding(db, { org, finding, asset: uid(4), actor });

    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        createRepair(
          {
            orgId: org,
            findingId: finding,
            actorId: actor,
            title: `Repair ${index}`,
          },
          db,
        ),
      ),
    );

    const codes = results.map((result) => {
      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") {
        throw new Error("expected a repair");
      }
      return result.repair.code;
    });
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^REP-\d{4,}$/);
      expect(code).toBe(formatRepairCode(BigInt(code.slice("REP-".length))));
    }
    expect(await stageOf(db, finding)).toBe("discovered");
  });

  it("returns not_found for another organization and does not consume a code", async () => {
    const org = uid(1);
    const other = uid(2);
    const finding = uid(3);
    const actor = uid(4);
    await seedFinding(db, { org, finding, asset: uid(5), actor });
    await db.insert(organizations).values({ id: other, name: "Other yard" });

    const before = await nextRepairCode(db);
    const result = await createRepair(
      {
        orgId: other,
        findingId: finding,
        actorId: actor,
        title: "Should not persist",
      },
      db,
    );
    const after = await nextRepairCode(db);

    expect(result).toEqual({ kind: "not_found" });
    expect(await listRepairs(org, undefined, db)).toEqual([]);
    expect(codeNumber(after)).toBe(codeNumber(before) + BigInt(1));
    expect(await stageOf(db, finding)).toBe("discovered");
  });

  it("lists only the organization's repairs and honors filters", async () => {
    const org = uid(1);
    const other = uid(2);
    const actor = uid(3);
    const firstFinding = uid(4);
    const secondFinding = uid(5);
    await seedFinding(db, { org, finding: firstFinding, asset: uid(6), actor });
    await seedFinding(db, {
      org,
      finding: secondFinding,
      asset: uid(7),
      actor,
      code: "FND-SECOND",
    });
    await db.insert(organizations).values({ id: other, name: "Other yard" });
    const otherFinding = uid(8);
    await seedFinding(db, {
      org: other,
      finding: otherFinding,
      asset: uid(9),
      actor: uid(10),
      code: "FND-OTHER",
    });

    const openRepair = await createRepair(
      {
        orgId: org,
        findingId: firstFinding,
        actorId: actor,
        title: "Open patch",
        status: "open",
      },
      db,
    );
    const doneRepair = await createRepair(
      {
        orgId: org,
        findingId: secondFinding,
        actorId: actor,
        title: "Finished replacement",
        type: "replacement",
        status: "completed",
      },
      db,
    );
    const hidden = await createRepair(
      {
        orgId: other,
        findingId: otherFinding,
        actorId: uid(10),
        title: "Other org repair",
      },
      db,
    );

    expect(openRepair.kind).toBe("ok");
    expect(doneRepair.kind).toBe("ok");
    expect(hidden.kind).toBe("ok");
    if (
      openRepair.kind !== "ok" ||
      doneRepair.kind !== "ok" ||
      hidden.kind !== "ok"
    ) {
      return;
    }

    await db
      .update(repairs)
      .set({ createdAt: new Date("2020-01-01T00:00:00.000Z") })
      .where(eq(repairs.id, openRepair.repair.id));
    await db
      .update(repairs)
      .set({ createdAt: new Date("2020-02-01T00:00:00.000Z") })
      .where(eq(repairs.id, doneRepair.repair.id));

    const listed = await listRepairs(org, undefined, db);
    expect(listed.map((repair) => repair.id)).toEqual([
      doneRepair.repair.id,
      openRepair.repair.id,
    ]);
    expect(listed.some((repair) => repair.id === hidden.repair.id)).toBe(false);

    const byFinding = await listRepairs(org, { findingId: firstFinding }, db);
    expect(byFinding.map((repair) => repair.id)).toEqual([
      openRepair.repair.id,
    ]);

    const byStatus = await listRepairs(org, { status: "completed" }, db);
    expect(byStatus.map((repair) => repair.id)).toEqual([doneRepair.repair.id]);

    expect(await listRepairs(other, undefined, db)).toEqual([hidden.repair]);
    expect(await getRepair(org, hidden.repair.id, db)).toBeNull();
  });

  it("setval skips existing repair codes", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    await seedFinding(db, { org, finding, asset: uid(4), actor });
    await db.insert(repairs).values({
      id: uid(5),
      code: "RPR-1001",
      issueId: finding,
      title: "Already stored",
    });
    await db.insert(repairs).values({
      id: uid(6),
      code: "REP-4242",
      issueId: finding,
      title: "Higher code",
    });

    await db.execute(migrationSetval());

    const result = await createRepair(
      {
        orgId: org,
        findingId: finding,
        actorId: actor,
        title: "Next code",
      },
      db,
    );

    expect(result).toMatchObject({
      kind: "ok",
      repair: { code: "REP-4243" },
    });
  });

  it("rolls back when the actor does not exist", async () => {
    const org = uid(1);
    const finding = uid(2);
    const actor = uid(3);
    await seedFinding(db, { org, finding, asset: uid(4), actor });

    await expect(
      createRepair(
        {
          orgId: org,
          findingId: finding,
          actorId: randomUUID(),
          title: "Missing actor",
        },
        db,
      ),
    ).rejects.toThrow();

    expect(await listRepairs(org, undefined, db)).toEqual([]);
    expect(await stageOf(db, finding)).toBe("discovered");
  });
});

const INTEGRATION_ID_PREFIX = "62000000-0000-4000-8000-";

function uid(n: number): string {
  return `${INTEGRATION_ID_PREFIX}${n.toString(16).padStart(12, "0")}`;
}

function codeNumber(code: string): bigint {
  return BigInt(code.slice("REP-".length));
}

function migrationSetval(): string {
  const sqlText = readFileSync(
    path.join(process.cwd(), "migrations", "0003_repair_codes.sql"),
    "utf8",
  );
  const statement = sqlText
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .find((part) => /\bsetval\s*\(/i.test(part));
  if (statement === undefined) {
    throw new Error("0003_repair_codes.sql is missing setval");
  }
  return statement;
}

async function seedFinding(
  db: Database,
  input: {
    org: string;
    finding: string;
    asset: string;
    actor: string;
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
    name: "Fitting",
  });
  await db.insert(issues).values({
    id: input.finding,
    code: input.code ?? `FND-${input.finding.slice(-4)}`,
    assetId: input.asset,
    description: "Cracked fitting.",
    severity: "high",
    stage: "discovered",
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

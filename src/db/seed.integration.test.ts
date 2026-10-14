import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/db";
import {
  demoEngineeringTitles,
  demoEngineers,
  demoOverdueDay,
} from "@/db/demo-seed";
import { createEngineer, listAnalyses, listEngineers } from "@/db/engineering";
import {
  isLoopbackDatabaseUrl,
  openIntegrationDatabase,
} from "@/db/integration";
import { seedDemo } from "@/db/seed";

const enabled = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!enabled)("demo seed", () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url || !isLoopbackDatabaseUrl(url)) {
      throw new Error(
        "RUN_DB_INTEGRATION requires a localhost DATABASE_URL. Neon is never used.",
      );
    }
    const opened = await openIntegrationDatabase(url);
    db = opened.db;
    close = opened.close;
  });

  afterAll(async () => {
    await close?.();
  });

  beforeEach(async () => {
    await db.execute(sql`
      TRUNCATE TABLE
        analysis_comments,
        analysis_attachments,
        engineering_analyses,
        engineers
      RESTART IDENTITY CASCADE
    `);
  });

  it("creates the demo engineers and analyses once", async () => {
    await seedDemo(db);
    await seedDemo(db);

    const engineers = await listEngineers(db);
    expect(engineers.map((engineer) => engineer.email).sort()).toEqual(
      demoEngineers.map((engineer) => engineer.email).sort(),
    );
    for (const input of demoEngineers) {
      expect(engineers).toContainEqual(
        expect.objectContaining({ email: input.email, role: input.role }),
      );
    }

    const analyses = await listAnalyses(db);
    expect(analyses).toHaveLength(3);
    const analyst = engineers.find(
      (engineer) => engineer.email === "analyst@example.com",
    );
    expect(analyses).toContainEqual(
      expect.objectContaining({
        title: demoEngineeringTitles.unassigned,
        status: "unassigned",
        assigneeId: null,
      }),
    );
    expect(analyses).toContainEqual(
      expect.objectContaining({
        title: demoEngineeringTitles.assigned,
        status: "assigned",
        assigneeId: analyst?.id,
      }),
    );
    expect(analyses).toContainEqual(
      expect.objectContaining({
        title: demoEngineeringTitles.overdue,
        status: "in_progress",
        assigneeId: analyst?.id,
        dueDate: demoOverdueDay,
      }),
    );
  });

  it("skips an engineer whose email differs only by case", async () => {
    const existing = await createEngineer(db, {
      name: "Already",
      email: "Analyst@example.com",
      role: "analyst",
    });
    await seedDemo(db);
    await seedDemo(db);

    const matches = (await listEngineers(db)).filter(
      (engineer) => engineer.email.toLowerCase() === "analyst@example.com",
    );
    expect(matches).toEqual([
      expect.objectContaining({
        id: existing.id,
        email: "Analyst@example.com",
      }),
    ]);
    const analyses = await listAnalyses(db);
    expect(analyses).toHaveLength(3);
    expect(analyses).toContainEqual(
      expect.objectContaining({
        title: demoEngineeringTitles.assigned,
        assigneeId: existing.id,
      }),
    );
  });
});

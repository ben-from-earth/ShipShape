import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "./index";
import {
  emptyDatabase,
  isLoopbackDatabaseUrl,
  openIntegrationDatabase,
} from "./integration";
import { assets, organizations } from "./schema";

const enabled = process.env.RUN_DB_INTEGRATION === "1";

function uid(n: number): string {
  return `40000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

function errorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join("\n");
}

describe.skipIf(!enabled)("issue severity", () => {
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

  it("backfills existing rows to medium and then requires severity", async () => {
    await emptyDatabase(db);

    const orgId = uid(1);
    const assetId = uid(2);
    const issueId = uid(3);
    await db.insert(organizations).values({ id: orgId, name: "Backfill" });
    await db.insert(assets).values({
      id: assetId,
      orgId,
      identifier: "BF-1",
    });

    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`alter table issues drop column severity`);
        await tx.execute(sql`
          insert into issues (id, code, asset_id, description)
          values (
            ${issueId}::uuid,
            'ISS-9001',
            ${assetId}::uuid,
            'before the column'
          )
        `);
        await tx.execute(
          sql`alter table issues add column severity issue_severity default 'medium' not null`,
        );
        await tx.execute(
          sql`alter table issues alter column severity drop default`,
        );

        const stored = await tx.execute<{ severity: string }>(sql`
          select severity
          from issues
          where id = ${issueId}::uuid
        `);
        expect(stored.rows[0]?.severity).toBe("medium");

        const meta = await tx.execute<{
          column_default: string | null;
          is_nullable: string;
        }>(sql`
          select column_default, is_nullable
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'issues'
            and column_name = 'severity'
        `);
        expect(meta.rows[0]?.column_default).toBeNull();
        expect(meta.rows[0]?.is_nullable).toBe("NO");

        let missingSeverity: unknown;
        try {
          await tx.execute(sql`
            insert into issues (id, code, asset_id, description)
            values (
              ${uid(4)}::uuid,
              'ISS-9002',
              ${assetId}::uuid,
              'missing severity'
            )
          `);
          missingSeverity = undefined;
        } catch (error) {
          missingSeverity = error;
        }
        expect(errorText(missingSeverity).toLowerCase()).toContain(
          "not-null constraint",
        );

        throw new Error("rollback severity probe");
      }),
    ).rejects.toThrow("rollback severity probe");
  });
});

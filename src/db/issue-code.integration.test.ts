import { readFileSync } from "node:fs";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "./index";
import {
  emptyDatabase,
  isLoopbackDatabaseUrl,
  openIntegrationDatabase,
} from "./integration";
import { formatIssueCode, nextIssueCode } from "./issue-code";
import { assets, issues, organizations } from "./schema";

const enabled = process.env.RUN_DB_INTEGRATION === "1";
const CONCURRENT_CALLS = 24;

function uid(n: number): string {
  return `30000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

function migrationSetval(): string {
  const sqlText = readFileSync(
    path.join(process.cwd(), "migrations", "0001_issue_code_seq.sql"),
    "utf8",
  );
  const statement = sqlText
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .find((part) => /\bsetval\s*\(/i.test(part));
  if (statement === undefined) {
    throw new Error("0001_issue_code_seq.sql is missing setval");
  }
  return statement;
}

describe.skipIf(!enabled)("issue code sequence", () => {
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

  it("returns distinct seed-shaped codes under concurrency", async () => {
    const codes = await Promise.all(
      Array.from({ length: CONCURRENT_CALLS }, () => nextIssueCode(db)),
    );

    expect(new Set(codes).size).toBe(CONCURRENT_CALLS);

    const numbers = codes.map((code) => {
      expect(code).toMatch(/^ISS-\d{4,}$/);
      const value = BigInt(code.slice("ISS-".length));
      expect(code).toBe(formatIssueCode(value));
      expect(value >= BigInt(1002)).toBe(true);
      return value;
    });

    const sorted = [...numbers].sort((left, right) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (previous === undefined || current === undefined) {
        throw new Error("expected a contiguous issue code");
      }
      expect(current).toBe(previous + BigInt(1));
    }
  });

  it("setval skips the demo seed and any higher ISS- code", async () => {
    await emptyDatabase(db);
    await db.execute(migrationSetval());

    const first = await nextIssueCode(db);
    expect(first).toBe("ISS-1002");
    expect(first).not.toBe("ISS-1001");

    const orgId = uid(1);
    const assetId = uid(2);
    await db.insert(organizations).values({ id: orgId, name: "Seq org" });
    await db.insert(assets).values({
      id: assetId,
      orgId,
      identifier: "SEQ-1",
    });
    await db.insert(issues).values({
      id: uid(3),
      code: "ISS-4321",
      severity: "critical",
      assetId,
      description: "Already stored",
    });

    await db.execute(migrationSetval());

    const code = await nextIssueCode(db);
    expect(code).toBe("ISS-4322");
    expect(code).not.toBe("ISS-4321");
  });
});

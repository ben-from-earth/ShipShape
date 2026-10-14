import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/db";
import {
  isLoopbackDatabaseUrl,
  openIntegrationDatabase,
} from "@/db/integration";
import {
  addAttachment,
  addComment,
  createAnalysis,
  createEngineer,
  getAnalysis,
  listAnalyses,
  listAttachments,
  listComments,
  listEngineers,
  transitionAnalysis,
  type TransitionResult,
} from "./engineering";
import { decryptDatabaseUrl, encryptDatabaseUrl } from "./tenant-secret";

const enabled = process.env.RUN_DB_INTEGRATION === "1";

describe.skipIf(!enabled)("tenant engineering data", () => {
  let db: Database;
  let close: () => Promise<void>;
  let databaseUrl = "";

  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url || !isLoopbackDatabaseUrl(url)) {
      throw new Error(
        "RUN_DB_INTEGRATION requires a localhost DATABASE_URL. Neon is never used.",
      );
    }
    databaseUrl = url;
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

  it("walks every transition and rejects the wrong role or status", async () => {
    const analyst = await createEngineer(db, {
      name: "Ada Analyst",
      email: "ada@example.com",
      role: "analyst",
    });
    const reviewer = await createEngineer(db, {
      name: "Ren Reviewer",
      email: "ren@example.com",
      role: "reviewer",
    });
    const approver = await createEngineer(db, {
      name: "Pat Approver",
      email: "pat@example.com",
      role: "approver",
    });
    const directory = await listEngineers(db);
    expect(directory.map((person) => person.email).sort()).toEqual(
      [analyst.email, reviewer.email, approver.email].sort(),
    );
    const stamps = directory.map((person) => person.createdAt);
    expect([...stamps].sort()).toEqual(stamps);

    const early = await createAnalysis(db, {
      title: "Too soon",
      createdBy: analyst.id,
    });
    expect(
      await transitionAnalysis({
        db,
        analysisId: early.id,
        actorId: approver.id,
        action: "approve",
      }),
    ).toEqual({ kind: "invalid_state", status: "unassigned" });

    const created = await createAnalysis(db, {
      title: "  Wing root  ",
      dueDate: "2026-12-01",
      createdBy: analyst.id,
    });
    expect(created).toMatchObject({
      title: "Wing root",
      status: "unassigned",
      assigneeId: null,
      dueDate: "2026-12-01",
      approvedAt: null,
      createdBy: analyst.id,
    });
    expect(created.code).toMatch(/^AN-\d{4,}$/);

    const assigned = await move(db, created.id, reviewer.id, "assign", {
      assigneeId: analyst.id,
    });
    expect(assigned).toMatchObject({
      status: "assigned",
      assigneeId: analyst.id,
    });
    expect(
      await transitionAnalysis({
        db,
        analysisId: created.id,
        actorId: reviewer.id,
        action: "start",
      }),
    ).toEqual({ kind: "forbidden" });

    const started = await move(db, created.id, analyst.id, "start");
    expect(started.status).toBe("in_progress");
    const submitted = await move(db, created.id, analyst.id, "submit");
    expect(submitted.status).toBe("waiting_for_review");
    const picked = await move(db, created.id, reviewer.id, "pick_up");
    expect(picked.status).toBe("in_review");
    expect(
      await transitionAnalysis({
        db,
        analysisId: created.id,
        actorId: analyst.id,
        action: "approve",
      }),
    ).toEqual({ kind: "forbidden" });
    expect((await getAnalysis(db, created.id))?.status).toBe("in_review");

    const sentBack = await move(db, created.id, reviewer.id, "send_back");
    expect(sentBack.status).toBe("in_progress");
    await move(db, created.id, analyst.id, "submit");
    await move(db, created.id, reviewer.id, "pick_up");
    const approved = await move(db, created.id, approver.id, "approve");
    expect(approved.status).toBe("approved");
    expect(approved.approvedAt).toEqual(expect.any(String));
    expect(await listAnalyses(db)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.id, status: "approved" }),
      ]),
    );
  });

  it("lets only the assignee start and submit", async () => {
    const owner = await createEngineer(db, {
      name: "Owner",
      email: "owner@example.com",
      role: "analyst",
    });
    const other = await createEngineer(db, {
      name: "Other",
      email: "other@example.com",
      role: "analyst",
    });
    const reviewer = await createEngineer(db, {
      name: "Reviewer",
      email: "reviewer@example.com",
      role: "reviewer",
    });
    const analysis = await createAnalysis(db, {
      title: "Assigned work",
      assigneeId: owner.id,
      createdBy: reviewer.id,
    });
    expect(analysis.status).toBe("assigned");

    expect(
      await transitionAnalysis({
        db,
        analysisId: analysis.id,
        actorId: other.id,
        action: "start",
      }),
    ).toEqual({ kind: "forbidden" });
    expect(
      await transitionAnalysis({
        db,
        analysisId: analysis.id,
        actorId: reviewer.id,
        action: "start",
      }),
    ).toEqual({ kind: "forbidden" });

    expect((await move(db, analysis.id, owner.id, "start")).status).toBe(
      "in_progress",
    );
    expect(
      await transitionAnalysis({
        db,
        analysisId: analysis.id,
        actorId: other.id,
        action: "submit",
      }),
    ).toEqual({ kind: "forbidden" });
    expect((await move(db, analysis.id, owner.id, "submit")).status).toBe(
      "waiting_for_review",
    );
  });

  it("accepts one of two concurrent approves", async () => {
    const analyst = await createEngineer(db, {
      name: "Ada",
      email: "ada-race@example.com",
      role: "analyst",
    });
    const reviewer = await createEngineer(db, {
      name: "Ren",
      email: "ren-race@example.com",
      role: "reviewer",
    });
    const approver = await createEngineer(db, {
      name: "Pat",
      email: "pat-race@example.com",
      role: "approver",
    });
    const analysis = await createAnalysis(db, {
      title: "Race",
      assigneeId: analyst.id,
    });
    await move(db, analysis.id, analyst.id, "start");
    await move(db, analysis.id, analyst.id, "submit");
    await move(db, analysis.id, reviewer.id, "pick_up");

    const [first, second] = await Promise.all([
      transitionAnalysis({
        db,
        analysisId: analysis.id,
        actorId: approver.id,
        action: "approve",
      }),
      transitionAnalysis({
        db,
        analysisId: analysis.id,
        actorId: approver.id,
        action: "approve",
      }),
    ]);
    const kinds = [first.kind, second.kind].sort();
    expect(kinds).toEqual(["invalid_state", "ok"]);
    const loser = [first, second].find(
      (result) => result.kind === "invalid_state",
    );
    expect(loser).toEqual({ kind: "invalid_state", status: "approved" });
    expect((await getAnalysis(db, analysis.id))?.status).toBe("approved");
  });

  it("stores comments oldest first and a file attachment", async () => {
    const author = await createEngineer(db, {
      name: "Ada",
      email: "ada-note@example.com",
      role: "analyst",
    });
    const analysis = await createAnalysis(db, { title: "Notes" });
    const first = await addComment(db, {
      analysisId: analysis.id,
      authorId: author.id,
      body: "  First.  ",
    });
    const second = await addComment(db, {
      analysisId: analysis.id,
      authorId: null,
      body: "Second.",
    });
    expect(first).not.toBeNull();
    await db.execute(sql`
      UPDATE analysis_comments
      SET created_at = created_at - interval '1 second'
      WHERE id = ${first?.id ?? null}::uuid
    `);
    expect(
      (await listComments(db, analysis.id)).map((entry) => entry.body),
    ).toEqual([first?.body, second?.body]);

    const attachment = await addAttachment(db, {
      analysisId: analysis.id,
      uploadedBy: author.id,
      fileName: "calc.pdf",
      url: "https://files.example.com/calc.pdf",
      contentType: "application/pdf",
      size: 1200,
    });
    expect(await listAttachments(db, analysis.id)).toEqual([attachment]);
    expect(
      await addComment(db, { analysisId: randomUUID(), body: "Missing." }),
    ).toBe(null);
  });

  it("rejects an assign when the assignee is missing and writes nothing", async () => {
    const reviewer = await createEngineer(db, {
      name: "Ren Reviewer",
      email: "ren-assign@example.com",
      role: "reviewer",
    });
    const approver = await createEngineer(db, {
      name: "Pat Approver",
      email: "pat-assign@example.com",
      role: "approver",
    });
    const analysis = await createAnalysis(db, { title: "Needs an owner" });

    expect(
      await transitionAnalysis({
        db,
        analysisId: analysis.id,
        actorId: reviewer.id,
        action: "assign",
        assigneeId: randomUUID(),
      }),
    ).toEqual({ kind: "invalid_assignee" });
    expect(await getAnalysis(db, analysis.id)).toMatchObject({
      status: "unassigned",
      assigneeId: null,
    });

    const assigned = await move(db, analysis.id, reviewer.id, "assign", {
      assigneeId: approver.id,
    });
    expect(assigned).toMatchObject({
      status: "assigned",
      assigneeId: approver.id,
    });
    expect(
      await transitionAnalysis({
        db,
        analysisId: analysis.id,
        actorId: reviewer.id,
        action: "assign",
        assigneeId: randomUUID(),
      }),
    ).toEqual({ kind: "invalid_state", status: "assigned" });
  });

  it("rejects an engineer email that differs only by case", async () => {
    const created = await createEngineer(db, {
      name: "Upper",
      email: "A@x.com",
      role: "analyst",
    });
    expect(created.email).toBe("A@x.com");
    await expect(
      createEngineer(db, {
        name: "Lower",
        email: "a@x.com",
        role: "reviewer",
      }),
    ).rejects.toSatisfy(isUniqueEmailConflict);
    expect((await listEngineers(db)).map((person) => person.email)).toEqual([
      "A@x.com",
    ]);
  });

  it("round-trips a tenant connection string through the control registry", async () => {
    const previous = process.env.TENANT_SECRET_KEY;
    process.env.TENANT_SECRET_KEY = randomBytes(32).toString("base64");
    try {
      const control = await openControlDatabase(databaseUrl);
      try {
        const tenantId = "71000000-0000-4000-8000-000000000001";
        const encrypted = encryptDatabaseUrl(databaseUrl);
        await control.pool.query(
          `INSERT INTO tenants (id, slug, name, database_url_encrypted)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (slug) DO UPDATE
             SET database_url_encrypted = EXCLUDED.database_url_encrypted`,
          [tenantId, "first", "Today's database", encrypted],
        );
        const stored = await control.pool.query<{
          database_url_encrypted: string;
        }>("SELECT database_url_encrypted FROM tenants WHERE id = $1", [
          tenantId,
        ]);
        expect(
          decryptDatabaseUrl(stored.rows[0]?.database_url_encrypted ?? ""),
        ).toBe(databaseUrl);
      } finally {
        await control.close();
      }
    } finally {
      if (previous === undefined) {
        delete process.env.TENANT_SECRET_KEY;
      } else {
        process.env.TENANT_SECRET_KEY = previous;
      }
    }
  });
});

function isUniqueEmailConflict(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (
      "code" in current &&
      current.code === "23505" &&
      "constraint" in current &&
      current.constraint === "engineers_email_uq"
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

async function move(
  db: Database,
  analysisId: string,
  actorId: string,
  action: "assign" | "start" | "submit" | "pick_up" | "send_back" | "approve",
  extra: { assigneeId?: string } = {},
): Promise<Extract<TransitionResult, { kind: "ok" }>["analysis"]> {
  const result = await transitionAnalysis({
    db,
    analysisId,
    actorId,
    action,
    ...extra,
  });
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") {
    throw new Error(`Expected ${action} to succeed.`);
  }
  return result.analysis;
}

async function openControlDatabase(tenantUrl: string): Promise<{
  pool: pg.Pool;
  close: () => Promise<void>;
}> {
  const adminUrl = new URL(tenantUrl);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const existing = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = 'shipshape_control'",
  );
  if (existing.rowCount === 0) {
    await admin.query("CREATE DATABASE shipshape_control");
  }
  await admin.end();

  const controlUrl = new URL(tenantUrl);
  controlUrl.pathname = "/shipshape_control";
  const pool = new pg.Pool({ connectionString: controlUrl.toString() });
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: path.join(process.cwd(), "migrations/control"),
  });
  return { pool, close: () => pool.end() };
}

import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import type { Database } from "@/db";
import { issueMedia, issues, stageTransitions } from "@/db/schema";

import { insertFinding, type FindingInsert } from "./persist";

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const issueId = "550e8400-e29b-41d4-a716-446655440031";
const photoId = "550e8400-e29b-41d4-a716-446655440032";
const transitionId = "550e8400-e29b-41d4-a716-446655440033";
const assetId = "550e8400-e29b-41d4-a716-446655440022";
const storedAt = new Date("2026-10-12T20:15:00.000Z");

function finding(): FindingInsert {
  return {
    id: issueId,
    assetId,
    description: "The cover is cracked along the fastener line.",
    severity: "high",
    zone: "bay 3",
    locationLabel: null,
    location: {},
    reportedBy: null,
    discoveredAt: null,
    photos: [
      {
        id: photoId,
        storageKey: `${orgId}/issues/${issueId}/${photoId}`,
        mimeType: "image/jpeg",
      },
    ],
    transitionId,
  };
}

describe("insertFinding", () => {
  it("writes the issue, photos, and discovered transition in one batch", async () => {
    const inserts: {
      table: unknown;
      value: Record<string, unknown> | Record<string, unknown>[];
    }[] = [];
    let batched: unknown[] | undefined;
    const db = {
      insert(table: unknown) {
        return {
          values(value: Record<string, unknown> | Record<string, unknown>[]) {
            const query = { table, value };
            inserts.push(query);
            return {
              returning() {
                return query;
              },
            };
          },
        };
      },
      async batch(queries: unknown[]) {
        batched = queries;
        return [
          [
            {
              id: issueId,
              code: "ISS-1002",
              stage: "discovered",
              severity: "high",
              createdAt: storedAt,
            },
          ],
          [
            {
              id: photoId,
              issueId,
              storageKey: `${orgId}/issues/${issueId}/${photoId}`,
              mimeType: "image/jpeg",
              caption: null,
              uploadedBy: null,
              createdAt: storedAt,
              updatedAt: storedAt,
            },
          ],
          [],
        ];
      },
    } as unknown as Database;

    const result = await insertFinding(db, finding());

    expect(inserts.map((entry) => entry.table)).toEqual([
      issues,
      issueMedia,
      stageTransitions,
    ]);
    expect(batched).toHaveLength(3);

    const issue = inserts[0]?.value as Record<string, unknown>;
    expect(issue.assetId).toBe(assetId);
    expect(issue.severity).toBe("high");
    expect(issue.stage).toBe("discovered");
    expect(issue.location).toEqual({});
    expect(issue.reportedBy).toBeNull();
    expect(issue).not.toHaveProperty("discoveredAt");
    const codeSql = new PgDialect().sqlToQuery(
      issue.code as Parameters<PgDialect["sqlToQuery"]>[0],
    );
    expect(codeSql.sql.match(/nextval/g)).toHaveLength(1);
    expect(codeSql.sql).toContain("issue_code_seq");

    const media = inserts[1]?.value as Record<string, unknown>[];
    expect(media[0]?.storageKey).toBe(`${orgId}/issues/${issueId}/${photoId}`);
    expect(media[0]?.caption).toBeNull();
    expect(media[0]?.uploadedBy).toBeNull();

    const transition = inserts[2]?.value as Record<string, unknown>;
    expect(transition).toMatchObject({
      id: transitionId,
      issueId,
      fromStage: null,
      toStage: "discovered",
      changedBy: null,
    });

    expect(result.code).toBe("ISS-1002");
    expect(result.stage).toBe("discovered");
    expect(result.photos[0]?.issueId).toBe(issueId);
  });

  it("refuses to open a batch for a finding with no photos", async () => {
    const db = {
      insert() {
        throw new Error("insert should not run");
      },
      async batch() {
        throw new Error("batch should not run");
      },
    } as unknown as Database;

    await expect(
      insertFinding(db, { ...finding(), photos: [] }),
    ).rejects.toThrow(/no photos/);
  });
});

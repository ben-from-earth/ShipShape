import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "@/db";
import {
  emptyDatabase,
  isLoopbackDatabaseUrl,
  openIntegrationDatabase,
} from "@/db/integration";
import { nextIssueCodeSql } from "@/db/issue-code";
import {
  assetGroups,
  assets,
  issueMedia,
  issues,
  organizations,
  stageTransitions,
} from "@/db/schema";
import type { FindingPhotoMediaType } from "@/config/findings";

import { readFinding, readFindingMedia, readFindings } from "./db";

const enabled = process.env.RUN_DB_INTEGRATION === "1";

function uid(n: number): string {
  return `50000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

function at(day: string, time = "12:00:00"): Date {
  return new Date(`${day}T${time}.000Z`);
}

describe.skipIf(!enabled)("finding readers", () => {
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

  it("returns nothing when the database has no organization", async () => {
    expect(await readFindings(db)).toEqual([]);
    expect(await readFinding(db, uid(1))).toBeNull();
    expect(await readFindingMedia(db, uid(1), uid(2))).toBeNull();
    expect(await readFinding(db, "not-a-uuid")).toBeNull();
  });

  it("scopes findings through the oldest organization and hides the other org", async () => {
    const orgA = uid(1);
    const orgB = uid(2);
    const sameDay = at("2026-01-01");
    const groupA = uid(21);
    const groupB = uid(22);
    const assetA1 = uid(31);
    const assetA2 = uid(32);
    const assetCross = uid(33);
    const assetB = uid(41);

    await db.insert(organizations).values([
      { id: orgA, name: "North Yard", createdAt: sameDay },
      { id: orgB, name: "Other Yard", createdAt: sameDay },
    ]);
    await db.insert(assetGroups).values([
      { id: groupA, orgId: orgA, name: "Yard cranes" },
      { id: groupB, orgId: orgB, name: "Other cranes" },
    ]);
    await db.insert(assets).values([
      {
        id: assetA1,
        orgId: orgA,
        groupId: groupA,
        identifier: "CR-1",
        name: "North crane",
      },
      {
        id: assetA2,
        orgId: orgA,
        identifier: "CR-2",
        name: null,
      },
      {
        id: assetCross,
        orgId: orgA,
        groupId: groupB,
        identifier: "CR-X",
        name: "Cross group",
      },
      {
        id: assetB,
        orgId: orgB,
        groupId: groupB,
        identifier: "OTHER",
        name: "Other crane",
      },
    ]);

    const late = uid(10);
    const tieLow = uid(20);
    const early = uid(30);
    const tieHigh = uid(40);
    const cross = uid(50);
    const other = uid(90);

    await db.insert(issues).values([
      {
        id: late,
        code: "FND-LATE",
        assetId: assetA1,
        zone: "Tail",
        locationLabel: "upper fitting",
        location: { bay: "3" },
        description: "Late crack",
        severity: "high",
        stage: "analysis",
        createdAt: at("2026-10-05"),
      },
      {
        id: tieLow,
        code: "FND-TIE-LOW",
        assetId: assetA2,
        zone: "Wing",
        locationLabel: null,
        description: "Tie low",
        severity: "high",
        stage: "discovered",
        createdAt: at("2026-10-04"),
      },
      {
        id: early,
        code: "FND-EARLY",
        assetId: assetA1,
        description: "Early review",
        severity: "medium",
        stage: "review",
        createdAt: at("2026-10-01", "08:00:00"),
      },
      {
        id: tieHigh,
        code: "FND-TIE-HIGH",
        assetId: assetA1,
        zone: null,
        locationLabel: null,
        description: "Tie high",
        severity: "low",
        stage: "discovered",
        createdAt: at("2026-10-04"),
      },
      {
        id: cross,
        code: "FND-CROSS",
        assetId: assetCross,
        description: "Group from the other org",
        severity: "low",
        stage: "discovered",
        createdAt: at("2026-09-01"),
      },
      {
        id: other,
        code: "FND-OTHER",
        assetId: assetB,
        zone: "Tail",
        description: "Other tenant",
        severity: "critical",
        stage: "discovered",
        createdAt: at("2026-10-06"),
      },
    ]);

    await db.insert(stageTransitions).values([
      {
        id: uid(301),
        issueId: late,
        fromStage: null,
        toStage: "discovered",
        changedAt: at("2026-10-05", "08:00:00"),
      },
      {
        id: uid(302),
        issueId: late,
        fromStage: "analysis",
        toStage: "closed",
        changedAt: at("2026-10-06", "18:00:00"),
      },
    ]);

    const photoEarlyTime = uid(110);
    const photoEarlyTimeLaterId = uid(120);
    const photoLater = uid(105);
    const photoEarlyFinding = uid(130);
    const photoOther = uid(190);

    await db.insert(issueMedia).values([
      {
        id: photoEarlyTime,
        issueId: late,
        storageKey: `${orgA}/issues/${late}/${photoEarlyTime}`,
        mimeType: "image/jpeg",
        createdAt: at("2026-10-05", "10:00:00"),
      },
      {
        id: photoEarlyTimeLaterId,
        issueId: late,
        storageKey: `${orgA}/issues/${late}/${photoEarlyTimeLaterId}`,
        mimeType: "image/png",
        createdAt: at("2026-10-05", "10:00:00"),
      },
      {
        id: photoLater,
        issueId: late,
        storageKey: `${orgA}/issues/${late}/${photoLater}`,
        mimeType: "image/webp",
        createdAt: at("2026-10-05", "11:00:00"),
      },
      {
        id: photoEarlyFinding,
        issueId: early,
        storageKey: `${orgA}/issues/${early}/${photoEarlyFinding}`,
        mimeType: "image/heic",
        createdAt: at("2026-10-01", "09:00:00"),
      },
      {
        id: photoOther,
        issueId: other,
        storageKey: `${orgB}/issues/${other}/${photoOther}`,
        mimeType: "image/jpeg",
        createdAt: at("2026-10-06", "12:00:00"),
      },
    ]);

    const findings = await readFindings(db);
    expect(findings.map((record) => record.id)).toEqual([
      late,
      tieHigh,
      tieLow,
      early,
      cross,
    ]);
    expect(findings.map((record) => record.code)).not.toContain("FND-OTHER");

    const lateRecord = findings[0];
    expect(lateRecord).toMatchObject({
      id: late,
      code: "FND-LATE",
      assetId: assetA1,
      description: "Late crack",
      severity: "high",
      stage: "analysis",
      zone: "Tail",
      locationLabel: "upper fitting",
      location: { bay: "3" },
      createdAt: "2026-10-05T12:00:00.000Z",
      asset: {
        id: assetA1,
        identifier: "CR-1",
        name: "North crane",
        assetGroup: { id: groupA, name: "Yard cranes" },
      },
    });
    expect(lateRecord).not.toHaveProperty("title");
    expect(lateRecord).not.toHaveProperty("notes");
    expect(lateRecord?.photos.map((photo) => photo.mediaId)).toEqual([
      photoEarlyTime,
      photoEarlyTimeLaterId,
      photoLater,
    ]);
    expect(lateRecord?.photos.map((photo) => photo.contentType)).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    expect(lateRecord?.photos.every((photo) => photo.size === null)).toBe(true);
    for (const photo of lateRecord?.photos ?? []) {
      expect(photo).not.toHaveProperty("url");
      expect(photo).not.toHaveProperty("publicUrl");
      expect(photo.storageKey.startsWith("http")).toBe(false);
      expect(JSON.stringify(photo)).not.toMatch(/https?:/);
    }

    expect(findings.find((record) => record.id === tieLow)?.asset).toEqual({
      id: assetA2,
      identifier: "CR-2",
      name: null,
      assetGroup: null,
    });
    expect(findings.find((record) => record.id === tieHigh)?.zone).toBeNull();
    expect(
      findings.find((record) => record.id === cross)?.asset.assetGroup,
    ).toBe(null);
    expect(findings.find((record) => record.id === early)?.photos).toEqual([
      {
        mediaId: photoEarlyFinding,
        storageKey: `${orgA}/issues/${early}/${photoEarlyFinding}`,
        contentType: "image/heic",
        size: null,
        createdAt: "2026-10-01T09:00:00.000Z",
      },
    ]);

    expect(await readFinding(db, late)).toEqual(lateRecord);
    expect(await readFinding(db, other)).toBeNull();
    expect(await readFinding(db, uid(404))).toBeNull();

    expect(await readFindings(db, { stage: "discovered" })).toMatchObject([
      { id: tieHigh },
      { id: tieLow },
      { id: cross },
    ]);
    expect(await readFindings(db, { severity: "high" })).toMatchObject([
      { id: late },
      { id: tieLow },
    ]);
    expect(await readFindings(db, { assetId: assetA2 })).toMatchObject([
      { id: tieLow },
    ]);
    expect(await readFindings(db, { assetId: assetB })).toEqual([]);
    expect(
      await readFindings(db, {
        stage: "discovered",
        severity: "high",
        assetId: assetA2,
      }),
    ).toMatchObject([{ id: tieLow }]);
    expect(await readFindings(db, { stage: "approved" })).toEqual([]);

    expect(await readFindingMedia(db, late, photoEarlyTime)).toEqual({
      storageKey: `${orgA}/issues/${late}/${photoEarlyTime}`,
      contentType: "image/jpeg",
      size: null,
    });
    expect(await readFindingMedia(db, late, photoEarlyFinding)).toBeNull();
    expect(await readFindingMedia(db, early, photoEarlyTime)).toBeNull();
    expect(await readFindingMedia(db, other, photoOther)).toBeNull();
    expect(await readFindingMedia(db, late, photoOther)).toBeNull();
    expect(await readFindingMedia(db, late, uid(404))).toBeNull();
    expect(await readFindingMedia(db, uid(404), photoEarlyTime)).toBeNull();
    expect(await readFindingMedia(db, "not-a-uuid", photoEarlyTime)).toBeNull();
  });

  it("uses the older organization when ids would pick the other way", async () => {
    const older = uid(2);
    const newer = uid(1);
    const assetOlder = uid(11);
    const assetNewer = uid(12);
    const findingOlder = uid(21);
    const findingNewer = uid(22);

    await db.insert(organizations).values([
      { id: newer, name: "Newer lower id", createdAt: at("2026-06-01") },
      { id: older, name: "Older higher id", createdAt: at("2026-01-01") },
    ]);
    await db.insert(assets).values([
      { id: assetOlder, orgId: older, identifier: "OLD" },
      { id: assetNewer, orgId: newer, identifier: "NEW" },
    ]);
    await db.insert(issues).values([
      {
        id: findingOlder,
        code: "FND-OLDER-ORG",
        assetId: assetOlder,
        description: "Visible",
        severity: "low",
        stage: "discovered",
      },
      {
        id: findingNewer,
        code: "FND-NEWER-ORG",
        assetId: assetNewer,
        description: "Hidden",
        severity: "low",
        stage: "discovered",
      },
    ]);

    const records = await readFindings(db);
    expect(records.map((record) => record.id)).toEqual([findingOlder]);
    expect(await readFinding(db, findingNewer)).toBeNull();
  });

  it("returns a finding written the way POST /api/findings inserts it", async () => {
    const orgA = uid(1);
    const orgB = uid(2);
    const groupA = uid(21);
    const assetA = uid(31);
    const assetB = uid(41);
    const findingId = uid(61);
    const otherFindingId = uid(62);
    const photoId = uid(71);
    const otherPhotoId = uid(72);
    const transitionId = uid(81);
    const otherTransitionId = uid(82);

    await db.insert(organizations).values([
      { id: orgA, name: "North Yard", createdAt: at("2026-01-01") },
      { id: orgB, name: "Other Yard", createdAt: at("2026-06-01") },
    ]);
    await db.insert(assetGroups).values({
      id: groupA,
      orgId: orgA,
      name: "Yard cranes",
    });
    await db.insert(assets).values([
      {
        id: assetA,
        orgId: orgA,
        groupId: groupA,
        identifier: "CR-1",
        name: "North crane",
      },
      { id: assetB, orgId: orgB, identifier: "OTHER" },
    ]);

    await insertLikeHandler(db, {
      id: findingId,
      assetId: assetA,
      description: "The cover is cracked along the fastener line.",
      severity: "high",
      zone: "bay 3",
      locationLabel: "upper fitting",
      location: { bay: "3" },
      photos: [
        {
          id: photoId,
          storageKey: `${orgA}/issues/${findingId}/${photoId}`,
          mimeType: "image/jpeg",
        },
      ],
      transitionId,
    });
    await insertLikeHandler(db, {
      id: otherFindingId,
      assetId: assetB,
      description: "Other yard cover.",
      severity: "low",
      zone: null,
      locationLabel: null,
      location: {},
      photos: [
        {
          id: otherPhotoId,
          storageKey: `${orgB}/issues/${otherFindingId}/${otherPhotoId}`,
          mimeType: "image/png",
        },
      ],
      transitionId: otherTransitionId,
    });

    const listed = await readFindings(db);
    expect(listed).toHaveLength(1);
    const record = listed[0];
    expect(record?.code).toMatch(/^ISS-\d+$/);
    expect(record).toMatchObject({
      id: findingId,
      assetId: assetA,
      description: "The cover is cracked along the fastener line.",
      severity: "high",
      stage: "discovered",
      zone: "bay 3",
      locationLabel: "upper fitting",
      location: { bay: "3" },
      asset: {
        id: assetA,
        identifier: "CR-1",
        name: "North crane",
        assetGroup: { id: groupA, name: "Yard cranes" },
      },
    });
    expect(record?.photos).toEqual([
      {
        mediaId: photoId,
        storageKey: `${orgA}/issues/${findingId}/${photoId}`,
        contentType: "image/jpeg",
        size: null,
        createdAt: record?.photos[0]?.createdAt,
      },
    ]);
    expect(record).not.toHaveProperty("title");
    expect(await readFinding(db, findingId)).toEqual(record);
    expect(await readFinding(db, otherFindingId)).toBeNull();
    expect(await readFindingMedia(db, findingId, photoId)).toEqual({
      storageKey: `${orgA}/issues/${findingId}/${photoId}`,
      contentType: "image/jpeg",
      size: null,
    });
    expect(await readFindingMedia(db, findingId, otherPhotoId)).toBeNull();
    expect(await readFindingMedia(db, otherFindingId, otherPhotoId)).toBeNull();
  });
});

/**
 * Same three writes as `insertFinding` in `src/server/findings/persist.ts`:
 * the issue at `discovered`, its `issue_media` rows (caption and
 * uploadedBy null), and the opening `stage_transitions` row. The CI
 * database is node-postgres, so this is three inserts instead of
 * `db.batch`. `code` still comes from `nextIssueCodeSql()`.
 */
async function insertLikeHandler(
  db: Database,
  input: {
    id: string;
    assetId: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    zone: string | null;
    locationLabel: string | null;
    location: Record<string, string>;
    photos: {
      id: string;
      storageKey: string;
      mimeType: FindingPhotoMediaType;
    }[];
    transitionId: string;
  },
): Promise<void> {
  await db.insert(issues).values({
    id: input.id,
    code: nextIssueCodeSql(),
    assetId: input.assetId,
    zone: input.zone,
    locationLabel: input.locationLabel,
    location: input.location,
    description: input.description,
    severity: input.severity,
    stage: "discovered",
    reportedBy: null,
  });
  await db.insert(issueMedia).values(
    input.photos.map((photo) => ({
      id: photo.id,
      issueId: input.id,
      storageKey: photo.storageKey,
      mimeType: photo.mimeType,
      caption: null,
      uploadedBy: null,
    })),
  );
  await db.insert(stageTransitions).values({
    id: input.transitionId,
    issueId: input.id,
    fromStage: null,
    toStage: "discovered",
    changedBy: null,
  });
}

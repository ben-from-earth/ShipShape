import "server-only";

import type { FindingPhotoMediaType } from "@/config/findings";
import type { Database } from "@/db";
import { nextIssueCodeSql } from "@/db/issue-code";
import { issueMedia, issues, stageTransitions } from "@/db/schema";
import type { FindingLocation, FindingSeverity } from "@/schemas";

export type FindingPhotoInsert = {
  id: string;
  storageKey: string;
  mimeType: FindingPhotoMediaType;
};

/**
 * Rows for one `db.batch`. `code` is filled by `nextIssueCodeSql()` in the
 * insert, not by this object. `discoveredAt` null means the column default.
 */
export type FindingInsert = {
  id: string;
  assetId: string;
  description: string;
  severity: FindingSeverity;
  zone: string | null;
  locationLabel: string | null;
  location: FindingLocation;
  reportedBy: string | null;
  discoveredAt: Date | null;
  photos: FindingPhotoInsert[];
  transitionId: string;
};

export type InsertedFindingPhoto = {
  id: string;
  issueId: string;
  storageKey: string;
  mimeType: string;
  caption: string | null;
  uploadedBy: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type InsertedFinding = {
  id: string;
  code: string;
  stage: "discovered";
  severity: FindingSeverity;
  createdAt: Date | string;
  photos: InsertedFindingPhoto[];
};

/**
 * Insert the issue, its photos, and the opening stage transition together.
 * neon-http cannot open an interactive transaction. `db.batch` submits
 * the three statements as one Neon transaction.
 */
export async function insertFinding(
  db: Database,
  finding: FindingInsert,
): Promise<InsertedFinding> {
  if (finding.photos.length === 0) {
    throw new Error("Refusing to insert a finding with no photos");
  }

  const [issueRows, mediaRows] = await db.batch([
    db
      .insert(issues)
      .values({
        id: finding.id,
        code: nextIssueCodeSql(),
        assetId: finding.assetId,
        zone: finding.zone,
        locationLabel: finding.locationLabel,
        location: finding.location,
        description: finding.description,
        severity: finding.severity,
        stage: "discovered",
        reportedBy: finding.reportedBy,
        ...(finding.discoveredAt ? { discoveredAt: finding.discoveredAt } : {}),
      })
      .returning({
        id: issues.id,
        code: issues.code,
        stage: issues.stage,
        severity: issues.severity,
        createdAt: issues.createdAt,
      }),
    db
      .insert(issueMedia)
      .values(
        finding.photos.map((photo) => ({
          id: photo.id,
          issueId: finding.id,
          storageKey: photo.storageKey,
          mimeType: photo.mimeType,
          caption: null,
          uploadedBy: null,
        })),
      )
      .returning({
        id: issueMedia.id,
        issueId: issueMedia.issueId,
        storageKey: issueMedia.storageKey,
        mimeType: issueMedia.mimeType,
        caption: issueMedia.caption,
        uploadedBy: issueMedia.uploadedBy,
        createdAt: issueMedia.createdAt,
        updatedAt: issueMedia.updatedAt,
      }),
    db.insert(stageTransitions).values({
      id: finding.transitionId,
      issueId: finding.id,
      fromStage: null,
      toStage: "discovered",
      changedBy: null,
    }),
  ]);

  const issue = issueRows[0];
  if (!issue || issue.stage !== "discovered") {
    throw new Error("Finding insert did not return a discovered issue.");
  }

  const photos = finding.photos.map((photo) => {
    const row = mediaRows.find((item) => item.id === photo.id);
    if (!row) {
      throw new Error("Finding insert did not return a photo.");
    }
    return row;
  });

  return {
    id: issue.id,
    code: issue.code,
    stage: issue.stage,
    severity: issue.severity,
    createdAt: issue.createdAt,
    photos,
  };
}

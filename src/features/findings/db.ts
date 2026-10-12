import "server-only";

import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { io } from "next/cache";

import { getDb, type Database } from "@/db";
import {
  assetGroups,
  assets,
  issueMedia,
  issues,
  organizations,
} from "@/db/schema";
import { oldestOrganizationOrder } from "@/lib/org-threshold";
import {
  findingListFiltersSchema,
  findingLocationSchema,
  findingMediaContentSchema,
  findingPhotoMetaSchema,
  findingRecordSchema,
  idSchema,
  type FindingListFilters,
  type FindingLocation,
  type FindingMediaContent,
  type FindingPhotoMeta,
  type FindingRecord,
} from "@/schemas";

import {
  getFinding as getDemoFinding,
  getFindingMedia as getDemoFindingMedia,
  listFindings as listDemoFindings,
} from "./demo";

/** Database handle the integration tests can pass in. */
export type FindingReader = Pick<Database, "select">;

type FindingRow = {
  id: string;
  code: string;
  assetId: string;
  description: string;
  severity: FindingRecord["severity"];
  stage: FindingRecord["stage"];
  zone: string | null;
  locationLabel: string | null;
  location: unknown;
  createdAt: Date | string;
  assetIdentifier: string;
  assetName: string | null;
  groupId: string | null;
  groupName: string | null;
};

type MediaRow = {
  id: string;
  issueId: string;
  storageKey: string;
  mimeType: string;
  createdAt: Date | string;
};

/**
 * Current stage is `issues.stage`. The dashboard pipeline counts that
 * column. `stage_transitions` is the history those counts do not
 * recompute from (age and throughput read it). A later transition that
 * was not written back onto the column does not change this value.
 */
function currentStage(columnStage: FindingRow["stage"]): FindingRow["stage"] {
  return columnStage;
}

function asTimestamp(value: Date | string): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new Error("Finding timestamp is invalid.");
  }
  return instant.toISOString();
}

function asLocation(value: unknown): FindingLocation {
  const parsed = findingLocationSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

function orgFilter(conditions: SQL[]): SQL {
  const combined = and(...conditions);
  if (!combined) {
    throw new Error("Finding query is missing its organization filter.");
  }
  return combined;
}

/**
 * Oldest organization, then the lowest id when `created_at` ties.
 * Same stand-in as the dashboard until a session exists (#13).
 */
async function resolveTenantOrgId(db: FindingReader): Promise<string | null> {
  const rows = await db
    .select({ id: organizations.id })
    .from(organizations)
    .orderBy(...oldestOrganizationOrder())
    .limit(1);
  return rows[0]?.id ?? null;
}

function findingWhere(
  orgId: string,
  filters: FindingListFilters,
  issueId?: string,
): SQL {
  const conditions: SQL[] = [eq(assets.orgId, orgId)];
  if (filters.stage !== undefined) {
    conditions.push(eq(issues.stage, filters.stage));
  }
  if (filters.severity !== undefined) {
    conditions.push(eq(issues.severity, filters.severity));
  }
  if (filters.assetId !== undefined) {
    conditions.push(eq(issues.assetId, filters.assetId));
  }
  if (issueId !== undefined) {
    conditions.push(eq(issues.id, issueId));
  }
  return orgFilter(conditions);
}

/**
 * Photos for many issues in one query. The organization filter is on
 * `assets.org_id`, not only the issue id list.
 */
async function loadPhotoMeta(
  db: FindingReader,
  orgId: string,
  issueIds: readonly string[],
): Promise<Map<string, FindingPhotoMeta[]>> {
  const grouped = new Map<string, FindingPhotoMeta[]>();
  if (issueIds.length === 0) {
    return grouped;
  }

  const rows: MediaRow[] = await db
    .select({
      id: issueMedia.id,
      issueId: issueMedia.issueId,
      storageKey: issueMedia.storageKey,
      mimeType: issueMedia.mimeType,
      createdAt: issueMedia.createdAt,
    })
    .from(issueMedia)
    .innerJoin(issues, eq(issueMedia.issueId, issues.id))
    .innerJoin(assets, eq(issues.assetId, assets.id))
    .where(
      orgFilter([
        eq(assets.orgId, orgId),
        inArray(issueMedia.issueId, [...issueIds]),
      ]),
    )
    .orderBy(asc(issueMedia.createdAt), asc(issueMedia.id));

  for (const row of rows) {
    const photo = findingPhotoMetaSchema.parse({
      mediaId: row.id,
      storageKey: row.storageKey,
      contentType: row.mimeType,
      size: null,
      createdAt: asTimestamp(row.createdAt),
    });
    const list = grouped.get(row.issueId) ?? [];
    list.push(photo);
    grouped.set(row.issueId, list);
  }

  return grouped;
}

function toRecord(row: FindingRow, photos: FindingPhotoMeta[]): FindingRecord {
  return findingRecordSchema.parse({
    id: row.id,
    code: row.code,
    assetId: row.assetId,
    description: row.description,
    severity: row.severity,
    stage: currentStage(row.stage),
    zone: row.zone,
    locationLabel: row.locationLabel,
    location: asLocation(row.location),
    createdAt: asTimestamp(row.createdAt),
    asset: {
      id: row.assetId,
      identifier: row.assetIdentifier,
      name: row.assetName,
      assetGroup:
        row.groupId !== null && row.groupName !== null
          ? { id: row.groupId, name: row.groupName }
          : null,
    },
    photos,
  });
}

async function selectFindings(
  db: FindingReader,
  orgId: string,
  filters: FindingListFilters,
  issueId?: string,
): Promise<FindingRecord[]> {
  const rows: FindingRow[] = await db
    .select({
      id: issues.id,
      code: issues.code,
      assetId: assets.id,
      description: issues.description,
      severity: issues.severity,
      stage: issues.stage,
      zone: issues.zone,
      locationLabel: issues.locationLabel,
      location: issues.location,
      createdAt: issues.createdAt,
      assetIdentifier: assets.identifier,
      assetName: assets.name,
      groupId: assetGroups.id,
      groupName: assetGroups.name,
    })
    .from(issues)
    .innerJoin(assets, eq(issues.assetId, assets.id))
    .leftJoin(
      assetGroups,
      orgFilter([
        eq(assets.groupId, assetGroups.id),
        eq(assetGroups.orgId, orgId),
      ]),
    )
    .where(findingWhere(orgId, filters, issueId))
    .orderBy(desc(issues.createdAt), desc(issues.id));

  const photos = await loadPhotoMeta(
    db,
    orgId,
    rows.map((row) => row.id),
  );

  return rows.map((row) => toRecord(row, photos.get(row.id) ?? []));
}

/**
 * Findings for an already-open database. Tests pass a node-postgres
 * client. `listFindings` is the page entry.
 * Ordered by `created_at` descending, then `id` descending.
 */
export async function readFindings(
  db: FindingReader,
  filters?: FindingListFilters,
): Promise<FindingRecord[]> {
  const parsed = findingListFiltersSchema.parse(filters ?? {});
  const orgId = await resolveTenantOrgId(db);
  if (!orgId) {
    return [];
  }
  return selectFindings(db, orgId, parsed);
}

/** Null when the id is not a UUID, the row is missing, or it is another org. */
export async function readFinding(
  db: FindingReader,
  id: string,
): Promise<FindingRecord | null> {
  if (!idSchema.safeParse(id).success) {
    return null;
  }
  const orgId = await resolveTenantOrgId(db);
  if (!orgId) {
    return null;
  }
  const rows = await selectFindings(db, orgId, {}, id);
  return rows[0] ?? null;
}

/**
 * Storage coordinates for one photo. Null when the media row is not on
 * that finding, or the finding's asset is not in the tenant organization.
 * Does not read the object.
 */
export async function readFindingMedia(
  db: FindingReader,
  findingId: string,
  mediaId: string,
): Promise<FindingMediaContent | null> {
  if (
    !idSchema.safeParse(findingId).success ||
    !idSchema.safeParse(mediaId).success
  ) {
    return null;
  }
  const orgId = await resolveTenantOrgId(db);
  if (!orgId) {
    return null;
  }

  const rows = await db
    .select({
      storageKey: issueMedia.storageKey,
      mimeType: issueMedia.mimeType,
    })
    .from(issueMedia)
    .innerJoin(issues, eq(issueMedia.issueId, issues.id))
    .innerJoin(assets, eq(issues.assetId, assets.id))
    .where(
      orgFilter([
        eq(assets.orgId, orgId),
        eq(issues.id, findingId),
        eq(issueMedia.id, mediaId),
      ]),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return findingMediaContentSchema.parse({
    storageKey: row.storageKey,
    contentType: row.mimeType,
    size: null,
  });
}

/**
 * Live finding list. With no `DATABASE_URL` this returns the demo
 * finding so `pnpm dev` and `pnpm build` still render. `io()` keeps
 * either path out of the static shell.
 */
export async function listFindings(
  filters?: FindingListFilters,
): Promise<FindingRecord[]> {
  await io();

  if (!process.env.DATABASE_URL) {
    return listDemoFindings(filters);
  }

  return readFindings(getDb(), filters);
}

/** Null when the finding does not exist in the tenant organization. */
export async function getFinding(id: string): Promise<FindingRecord | null> {
  await io();

  if (!process.env.DATABASE_URL) {
    return getDemoFinding(id);
  }

  return readFinding(getDb(), id);
}

/** Null when the photo is not on that finding in the tenant organization. */
export async function getFindingMedia(
  findingId: string,
  mediaId: string,
): Promise<FindingMediaContent | null> {
  await io();

  if (!process.env.DATABASE_URL) {
    return getDemoFindingMedia(findingId, mediaId);
  }

  return readFindingMedia(getDb(), findingId, mediaId);
}

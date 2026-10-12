import "server-only";
import { randomUUID } from "node:crypto";

import {
  MAX_FINDING_PHOTO_BYTES,
  MAX_FINDING_PHOTOS,
  canonicalFindingPhotoMediaType,
  findingPhotoFileExtension,
  findingPhotoMediaTypeForExtension,
  sniffedFindingPhotoMediaType,
  type FindingPhotoMediaType,
} from "@/config/findings";
import { getDb } from "@/db";
import {
  createFindingFieldsSchema,
  createFindingResultSchema,
  idSchema,
  type CreateFindingResult,
} from "@/schemas";
import { detailsFromZod } from "@/server/documents/errors";
import { createLocalDiskStorage, type ObjectStorage } from "@/server/storage";

import { assetBelongsToOrg, reporterBelongsToOrg } from "./access";
import { FindingRequestError } from "./errors";
import {
  insertFinding,
  type FindingInsert,
  type InsertedFinding,
} from "./persist";

export type FindingPhotoUpload = {
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
};

export type CreateFindingInput = {
  orgId: string;
  fields: Record<string, unknown>;
  photos: FindingPhotoUpload[];
};

export type CreateFindingDependencies = {
  storage: ObjectStorage;
  assetInOrg: (orgId: string, assetId: string) => Promise<boolean>;
  reporterInOrg: (orgId: string, userId: string) => Promise<boolean>;
  insertFinding: (finding: FindingInsert) => Promise<InsertedFinding>;
};

const PHOTO_TYPE_MESSAGE =
  "This photo type is not supported. Upload a JPEG, PNG, WebP, HEIC, or HEIF file.";

/**
 * Validate a finding, store its photos, then insert the issue.
 * Organization, asset, text, and photo checks all finish before the
 * first `put`. If a later `put` or the insert fails, stored photos
 * are deleted. There is no demo-data fallback.
 */
export async function createFinding(
  input: CreateFindingInput,
  dependencies: CreateFindingDependencies = defaultDependencies(),
): Promise<CreateFindingResult> {
  const orgId = requireOrgId(input.orgId);
  const fields = parseFields(input.fields);
  if (fields.reportedBy) {
    const reporterOk = await dependencies.reporterInOrg(
      orgId,
      fields.reportedBy,
    );
    if (!reporterOk) {
      throw new FindingRequestError(
        "validation_error",
        "reportedBy must be a user in this organization.",
        [
          {
            path: "reportedBy",
            message: "reportedBy must be a user in this organization.",
          },
        ],
      );
    }
  }

  const assetOk = await dependencies.assetInOrg(orgId, fields.assetId);
  if (!assetOk) {
    throw new FindingRequestError(
      "asset_not_found",
      "No asset with that id belongs to this organization.",
    );
  }

  const prepared = preparePhotos(input.photos);
  const issueId = randomUUID();
  const stored: {
    id: string;
    storageKey: string;
    mimeType: FindingPhotoMediaType;
  }[] = [];

  try {
    for (const photo of prepared) {
      const photoId = randomUUID();
      const requestedKey = `${orgId}/issues/${issueId}/${photoId}`;
      const saved = await dependencies.storage.put(requestedKey, photo.bytes);
      stored.push({
        id: photoId,
        storageKey: saved.key,
        mimeType: photo.mimeType,
      });
    }
  } catch (error) {
    await deleteStored(
      dependencies.storage,
      stored.map((photo) => photo.storageKey),
    );
    throw error;
  }

  const finding: FindingInsert = {
    id: issueId,
    assetId: fields.assetId,
    description: fields.description,
    severity: fields.severity,
    zone: fields.zone ?? null,
    locationLabel: fields.locationLabel ?? null,
    location: fields.location ?? {},
    reportedBy: fields.reportedBy ?? null,
    discoveredAt: fields.discoveredAt ? new Date(fields.discoveredAt) : null,
    photos: stored,
    transitionId: randomUUID(),
  };

  let inserted: InsertedFinding;
  try {
    inserted = await dependencies.insertFinding(finding);
  } catch (error) {
    await deleteStored(
      dependencies.storage,
      stored.map((photo) => photo.storageKey),
    );
    if (isForeignKeyViolation(error)) {
      throw new FindingRequestError(
        "validation_error",
        "The asset or reporter was not found.",
      );
    }
    throw error;
  }

  return createFindingResultSchema.parse({
    id: inserted.id,
    code: inserted.code,
    stage: inserted.stage,
    severity: inserted.severity,
    createdAt: asTimestamp(inserted.createdAt),
    photos: inserted.photos.map((photo) => ({
      id: photo.id,
      issueId: photo.issueId,
      storageKey: photo.storageKey,
      mimeType: photo.mimeType,
      caption: photo.caption,
      uploadedBy: photo.uploadedBy,
      createdAt: asTimestamp(photo.createdAt),
      updatedAt: asTimestamp(photo.updatedAt),
    })),
  });
}

function defaultDependencies(): CreateFindingDependencies {
  const db = getDb();
  return {
    storage: createLocalDiskStorage(),
    assetInOrg: (orgId, assetId) => assetBelongsToOrg(db, orgId, assetId),
    reporterInOrg: (orgId, userId) => reporterBelongsToOrg(db, orgId, userId),
    insertFinding: (finding) => insertFinding(db, finding),
  };
}

function requireOrgId(orgId: string): string {
  const parsed = idSchema.safeParse(orgId);
  if (!parsed.success) {
    throw new FindingRequestError("validation_error", "orgId must be a UUID.", [
      {
        path: "orgId",
        message: detailsFromZod(parsed.error)[0]?.message ?? "Invalid id",
      },
    ]);
  }
  return parsed.data;
}

function parseFields(fields: Record<string, unknown>) {
  const parsed = createFindingFieldsSchema.safeParse(fields);
  if (!parsed.success) {
    throw new FindingRequestError(
      "validation_error",
      "Request validation failed.",
      detailsFromZod(parsed.error),
    );
  }
  return parsed.data;
}

function preparePhotos(
  photos: FindingPhotoUpload[],
): { bytes: Uint8Array; mimeType: FindingPhotoMediaType }[] {
  if (photos.length === 0) {
    throw new FindingRequestError(
      "validation_error",
      "At least one photo is required.",
      [{ path: "photos", message: "At least one photo is required." }],
    );
  }

  if (photos.length > MAX_FINDING_PHOTOS) {
    throw new FindingRequestError(
      "too_many_photos",
      `A finding accepts at most ${MAX_FINDING_PHOTOS} photos.`,
    );
  }

  return photos.map((photo) => ({
    bytes: photo.bytes,
    mimeType: assertPhoto(photo),
  }));
}

function assertPhoto(photo: FindingPhotoUpload): FindingPhotoMediaType {
  if (photo.bytes.byteLength === 0) {
    throw new FindingRequestError("validation_error", "A photo is empty.", [
      { path: "photos", message: "A photo is empty." },
    ]);
  }

  if (photo.bytes.byteLength > MAX_FINDING_PHOTO_BYTES) {
    throw new FindingRequestError(
      "payload_too_large",
      "A photo is larger than 15 MB.",
    );
  }

  const declared = photo.mediaType.trim();
  if (declared.length === 0) {
    throw new FindingRequestError(
      "validation_error",
      "A media type is required.",
      [{ path: "photos", message: "A media type is required." }],
    );
  }

  const expected = findingPhotoMediaTypeForExtension(
    findingPhotoFileExtension(photo.fileName),
  );
  const mediaType = canonicalFindingPhotoMediaType(declared);
  if (expected === null || mediaType === null) {
    throw new FindingRequestError("unsupported_media_type", PHOTO_TYPE_MESSAGE);
  }
  if (mediaType !== expected) {
    throw new FindingRequestError(
      "unsupported_media_type",
      "The file extension does not match its media type.",
    );
  }
  if (sniffedFindingPhotoMediaType(photo.bytes) !== mediaType) {
    throw new FindingRequestError(
      "unsupported_media_type",
      "The file contents do not match its media type.",
    );
  }
  return mediaType;
}

async function deleteStored(
  storage: ObjectStorage,
  keys: string[],
): Promise<void> {
  for (const key of keys) {
    await storage.delete(key).catch((cleanupError: unknown) => {
      console.error(
        "Could not remove a finding photo after a failed write",
        cleanupError,
      );
    });
  }
}

function asTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function isForeignKeyViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && current.code === "23503") {
      return true;
    }
    if (
      "message" in current &&
      typeof current.message === "string" &&
      current.message.includes("violates foreign key constraint")
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

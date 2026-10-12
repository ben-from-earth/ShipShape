import {
  findingLocationSchema,
  findingMediaContentSchema,
  findingPhotoMetaSchema,
  findingPhotoSchema,
  type FindingLocation,
  type FindingMediaContent,
  type FindingPhotoMeta,
} from "@/schemas";

/**
 * `issues.location` when it is a JSON object. Anything else is null.
 * `{}` is a real stored value (the column default) and is kept.
 */
export function readStoredLocation(
  findingId: string,
  value: unknown,
): FindingLocation {
  const parsed = findingLocationSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  console.warn(
    `Finding ${findingId} location is not a JSON object; returning null.`,
  );
  return null;
}

/**
 * One photo for a finding record. An unexpected mime type is omitted
 * so the rest of `listFindings` / `getFinding` still returns.
 */
export function readStoredPhoto(row: {
  id: string;
  issueId: string;
  mimeType: string;
  createdAt: string;
}): FindingPhotoMeta | null {
  if (!isStoredPhotoType(row.mimeType)) {
    warnSkippedPhoto(row.issueId, row.id, row.mimeType);
    return null;
  }

  const parsed = findingPhotoMetaSchema.safeParse({
    mediaId: row.id,
    contentType: row.mimeType,
    size: null,
    createdAt: row.createdAt,
  });
  if (!parsed.success) {
    console.warn(
      `Skipping issue_media ${row.id} on finding ${row.issueId}: photo metadata could not be read.`,
    );
    return null;
  }
  return parsed.data;
}

/** Storage coordinates for one photo, or null when the mime type is not stored. */
export function readStoredMediaContent(row: {
  findingId: string;
  mediaId: string;
  storageKey: string;
  mimeType: string;
}): FindingMediaContent | null {
  if (!isStoredPhotoType(row.mimeType)) {
    warnSkippedPhoto(row.findingId, row.mediaId, row.mimeType);
    return null;
  }

  const parsed = findingMediaContentSchema.safeParse({
    storageKey: row.storageKey,
    contentType: row.mimeType,
    size: null,
  });
  if (!parsed.success) {
    console.warn(
      `Skipping issue_media ${row.mediaId} on finding ${row.findingId}: photo metadata could not be read.`,
    );
    return null;
  }
  return parsed.data;
}

function isStoredPhotoType(mimeType: string): boolean {
  return findingPhotoSchema.shape.mimeType.safeParse(mimeType).success;
}

function warnSkippedPhoto(
  findingId: string,
  mediaId: string,
  mimeType: string,
): void {
  console.warn(
    `Skipping issue_media ${mediaId} on finding ${findingId}: mime type ${mimeType} is not a stored photo type.`,
  );
}

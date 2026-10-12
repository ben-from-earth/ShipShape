/**
 * Photo and text limits for a finding, shared by the client and the server.
 * No server imports: a form can read these without pulling in storage.
 *
 * `mediaTypes[0]` is the type we store. Later entries are aliases some
 * clients send for the same extension (JPEG, mostly).
 *
 * HEIC and HEIF are included because phone cameras still shoot them.
 * The bytes are stored as uploaded. Nothing here transcodes them.
 */

export const MAX_FINDING_PHOTO_BYTES = 15 * 1024 * 1024;

export const MIN_FINDING_PHOTOS = 1;

export const MAX_FINDING_PHOTOS = 10;

/** Matches `longTextSchema` in src/schemas/common.ts. `issues.description`. */
export const MAX_FINDING_DESCRIPTION_LENGTH = 5_000;

/** Matches `shortTextSchema`. `issues.zone`. */
export const MAX_FINDING_ZONE_LENGTH = 200;

/** Matches `shortTextSchema`. `issues.location_label`. */
export const MAX_FINDING_LOCATION_LABEL_LENGTH = 200;

/** Character cap on the `location` form field before it is parsed as JSON. */
export const MAX_FINDING_LOCATION_JSON_LENGTH = 2_000;

/** `issue_media.caption`. Create does not send one; the stored value may. */
export const MAX_FINDING_CAPTION_LENGTH = 500;

/** `issues.code`, assigned by the server. */
export const MAX_FINDING_CODE_LENGTH = 64;

/**
 * HTTP status for each finding error code. Document routes keep their own
 * codes (`validation_error`, `payload_too_large`, `unsupported_media_type`).
 * `internal_error` is shared and stays 500.
 */
export const FINDING_ERROR_HTTP_STATUS = {
  invalid_org_id: 400,
  unknown_organization: 400,
  validation_failed: 400,
  asset_not_found: 404,
  too_many_photos: 400,
  photo_too_large: 413,
  unsupported_photo_type: 415,
} as const;

export type FindingErrorCode = keyof typeof FINDING_ERROR_HTTP_STATUS;

export const FINDING_PHOTO_TYPES = [
  {
    extensions: [".jpg", ".jpeg"],
    mediaTypes: ["image/jpeg", "image/jpg"],
  },
  {
    extensions: [".png"],
    mediaTypes: ["image/png"],
  },
  {
    extensions: [".webp"],
    mediaTypes: ["image/webp"],
  },
  {
    extensions: [".heic"],
    mediaTypes: ["image/heic"],
  },
  {
    extensions: [".heif"],
    mediaTypes: ["image/heif"],
  },
] as const;

export const FINDING_PHOTO_EXTENSIONS = FINDING_PHOTO_TYPES.flatMap(
  (type) => type.extensions,
);

/** Every accepted Content-Type, including the JPEG alias. */
export const FINDING_PHOTO_MEDIA_TYPES = FINDING_PHOTO_TYPES.flatMap(
  (type) => type.mediaTypes,
);

/** Media types stored on `issue_media.mime_type`. Aliases are not in this list. */
export const FINDING_PHOTO_STORED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type FindingPhotoMediaType =
  (typeof FINDING_PHOTO_STORED_MEDIA_TYPES)[number];

/** Stored media type for an extension such as ".jpg", or null. */
export function findingPhotoMediaTypeForExtension(
  extension: string,
): string | null {
  const normalized = extension.toLowerCase();
  const match = FINDING_PHOTO_TYPES.find((type) =>
    type.extensions.some((item) => item === normalized),
  );
  return match?.mediaTypes[0] ?? null;
}

/**
 * Stored media type for a Content-Type header, or null when it is not
 * one of FINDING_PHOTO_MEDIA_TYPES. Parameters such as charset are ignored.
 */
export function canonicalFindingPhotoMediaType(
  mimeType: string,
): string | null {
  const [base] = mimeType.split(";");
  const normalized = base?.trim().toLowerCase() ?? "";
  const match = FINDING_PHOTO_TYPES.find((type) =>
    type.mediaTypes.some((item) => item === normalized),
  );
  return match?.mediaTypes[0] ?? null;
}

/** Extension of a file name, including the dot, or "" when there is none. */
export function findingPhotoFileExtension(fileName: string): string {
  const base = fileName.replaceAll("\\", "/").split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return base.slice(dot).toLowerCase();
}

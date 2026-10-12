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

/**
 * Cap on `JSON.stringify` of the parsed `location` object. A multipart
 * string longer than this is rejected before it is parsed.
 */
export const MAX_FINDING_LOCATION_JSON_LENGTH = 2_000;

/** `issue_media.caption`. Create does not send one; the stored value may. */
export const MAX_FINDING_CAPTION_LENGTH = 500;

/**
 * Cap on `issues.code` in the 201 body. The value comes from
 * `nextIssueCodeSql()`, stored as text. Clients do not send it.
 */
export const MAX_FINDING_CODE_LENGTH = 64;

/**
 * HTTP status for finding failures. Shared codes (`validation_error`,
 * `payload_too_large`, `unsupported_media_type`, `invalid_org_id`,
 * `unknown_organization`) match document routes. Finding-only codes are
 * `asset_not_found`, `too_many_photos`, and `not_found`. `internal_error`
 * stays 500.
 */
export const FINDING_ERROR_HTTP_STATUS = {
  invalid_org_id: 400,
  unknown_organization: 400,
  validation_error: 400,
  asset_not_found: 404,
  too_many_photos: 400,
  payload_too_large: 413,
  unsupported_media_type: 415,
  not_found: 404,
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
): FindingPhotoMediaType | null {
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
): FindingPhotoMediaType | null {
  const [base] = mimeType.split(";");
  const normalized = base?.trim().toLowerCase() ?? "";
  const match = FINDING_PHOTO_TYPES.find((type) =>
    type.mediaTypes.some((item) => item === normalized),
  );
  return match?.mediaTypes[0] ?? null;
}

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "hevc",
  "hevx",
  "heim",
  "heis",
  "hevm",
  "hevs",
]);

const HEIF_BRANDS = new Set(["heif", "mif1", "msf1"]);

/**
 * Stored media type implied by the photo's leading bytes, or null.
 * JPEG is `FF D8 FF`. PNG is the 8-byte signature. WebP is `RIFF`/`WEBP`.
 * HEIC and HEIF are an `ftyp` box; the major brand wins.
 */
export function sniffedFindingPhotoMediaType(
  bytes: Uint8Array,
): FindingPhotoMediaType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }
  return heifMediaType(bytes);
}

function heifMediaType(bytes: Uint8Array): FindingPhotoMediaType | null {
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== "ftyp") {
    return null;
  }

  const boxSize = readUint32(bytes, 0);
  const limit = Math.min(bytes.length, boxSize > 7 ? boxSize : bytes.length);
  const major = ascii(bytes, 8, 4);
  const majorType = brandMediaType(major);
  if (majorType) {
    return majorType;
  }

  for (let offset = 16; offset + 4 <= limit; offset += 4) {
    const brandType = brandMediaType(ascii(bytes, offset, 4));
    if (brandType) {
      return brandType;
    }
  }
  return null;
}

function brandMediaType(brand: string): FindingPhotoMediaType | null {
  if (HEIC_BRANDS.has(brand)) {
    return "image/heic";
  }
  if (HEIF_BRANDS.has(brand)) {
    return "image/heif";
  }
  return null;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(bytes[offset + index] ?? 0);
  }
  return text;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  );
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

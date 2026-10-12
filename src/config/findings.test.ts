import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  FINDING_ERROR_HTTP_STATUS,
  FINDING_PHOTO_EXTENSIONS,
  FINDING_PHOTO_MEDIA_TYPES,
  FINDING_PHOTO_STORED_MEDIA_TYPES,
  FINDING_PHOTO_TYPES,
  MAX_FINDING_CAPTION_LENGTH,
  MAX_FINDING_CODE_LENGTH,
  MAX_FINDING_DESCRIPTION_LENGTH,
  MAX_FINDING_LOCATION_JSON_LENGTH,
  MAX_FINDING_LOCATION_LABEL_LENGTH,
  MAX_FINDING_PHOTO_BYTES,
  MAX_FINDING_PHOTOS,
  MAX_FINDING_ZONE_LENGTH,
  MIN_FINDING_PHOTOS,
  canonicalFindingPhotoMediaType,
  findingPhotoFileExtension,
  findingPhotoMediaTypeForExtension,
} from "@/config/findings";

describe("finding photo config", () => {
  it("lists each extension and media type once", () => {
    expect(new Set(FINDING_PHOTO_EXTENSIONS).size).toBe(
      FINDING_PHOTO_EXTENSIONS.length,
    );
    expect(new Set(FINDING_PHOTO_MEDIA_TYPES).size).toBe(
      FINDING_PHOTO_MEDIA_TYPES.length,
    );
    expect(FINDING_PHOTO_EXTENSIONS).toEqual([
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".heic",
      ".heif",
    ]);
    expect(FINDING_PHOTO_MEDIA_TYPES).toEqual([
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ]);
    expect(FINDING_PHOTO_STORED_MEDIA_TYPES).toEqual(
      FINDING_PHOTO_TYPES.map((type) => type.mediaTypes[0]),
    );
    expect(FINDING_PHOTO_TYPES).toHaveLength(5);
  });

  it("caps each photo at 15 MB and a finding at 10 photos", () => {
    expect(MAX_FINDING_PHOTO_BYTES).toBe(15 * 1024 * 1024);
    expect(MIN_FINDING_PHOTOS).toBe(1);
    expect(MAX_FINDING_PHOTOS).toBe(10);
    expect(MAX_FINDING_DESCRIPTION_LENGTH).toBe(5_000);
    expect(MAX_FINDING_ZONE_LENGTH).toBe(200);
    expect(MAX_FINDING_LOCATION_LABEL_LENGTH).toBe(200);
    expect(MAX_FINDING_LOCATION_JSON_LENGTH).toBe(2_000);
    expect(MAX_FINDING_CAPTION_LENGTH).toBe(500);
    expect(MAX_FINDING_CODE_LENGTH).toBe(64);
  });

  it("stores JPEG aliases as image/jpeg and keeps HEIC", () => {
    expect(canonicalFindingPhotoMediaType("image/jpg")).toBe("image/jpeg");
    expect(canonicalFindingPhotoMediaType("image/jpeg; charset=binary")).toBe(
      "image/jpeg",
    );
    expect(findingPhotoMediaTypeForExtension(".jpg")).toBe("image/jpeg");
    expect(findingPhotoMediaTypeForExtension(".JPEG")).toBe("image/jpeg");
    expect(findingPhotoMediaTypeForExtension(".heic")).toBe("image/heic");
    expect(canonicalFindingPhotoMediaType("image/heif")).toBe("image/heif");
    expect(canonicalFindingPhotoMediaType("image/gif")).toBeNull();
    expect(findingPhotoMediaTypeForExtension(".gif")).toBeNull();
    expect(findingPhotoFileExtension("photos\\Bay 3.HEIC")).toBe(".heic");
    expect(findingPhotoFileExtension("no-extension")).toBe("");
  });

  it("maps finding error codes to HTTP status", () => {
    expect(FINDING_ERROR_HTTP_STATUS).toEqual({
      invalid_org_id: 400,
      unknown_organization: 400,
      validation_error: 400,
      asset_not_found: 404,
      too_many_photos: 400,
      payload_too_large: 413,
      unsupported_media_type: 415,
    });
  });

  it("stays free of server imports", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/config/findings.ts"),
      "utf8",
    );

    expect(source).not.toContain("server-only");
    expect(source).not.toContain("@/db");
    expect(source).not.toContain("@/server");
  });
});

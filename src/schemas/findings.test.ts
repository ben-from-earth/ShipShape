import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  FINDING_ERROR_HTTP_STATUS,
  MAX_FINDING_DESCRIPTION_LENGTH,
  MAX_FINDING_LOCATION_JSON_LENGTH,
  MAX_FINDING_PHOTOS,
  MAX_FINDING_ZONE_LENGTH,
} from "@/config/findings";
import {
  apiErrorSchema,
  createFindingFieldsSchema,
  createFindingResultSchema,
  findingLocationSchema,
  findingPhotoSchema,
  findingStageSchema,
} from "@/schemas";

const assetId = "550e8400-e29b-41d4-a716-446655440022";
const reporterId = "550e8400-e29b-41d4-a716-446655440011";
const findingId = "550e8400-e29b-41d4-a716-446655440031";
const photoId = "550e8400-e29b-41d4-a716-446655440032";

const fields = {
  assetId,
  description: "The cover is cracked along the fastener line.",
  zone: "bay 3",
  locationLabel: "upper fitting",
  location: '{"bay":"3","position":"upper"}',
  reportedBy: reporterId,
  discoveredAt: "2026-10-12T18:04:00.000Z",
};

const photo = {
  id: photoId,
  storageKey: `${assetId}/issues/${findingId}/${photoId}`,
  mimeType: "image/jpeg" as const,
  caption: null,
};

describe("createFindingFieldsSchema", () => {
  it("accepts the issues columns a field technician can send", () => {
    const parsed = createFindingFieldsSchema.parse({
      ...fields,
      assetId: `  ${assetId}  `,
      description: "  The cover is cracked along the fastener line.  ",
      zone: "  bay 3  ",
    });

    expect(parsed.assetId).toBe(assetId);
    expect(parsed.description).toBe(
      "The cover is cracked along the fastener line.",
    );
    expect(parsed.zone).toBe("bay 3");
    expect(parsed.locationLabel).toBe("upper fitting");
    expect(parsed.location).toEqual({ bay: "3", position: "upper" });
    expect(parsed.reportedBy).toBe(reporterId);
    expect(parsed.discoveredAt).toBe("2026-10-12T18:04:00.000Z");
    expect(findingLocationSchema.parse(parsed.location).bay).toBe("3");
  });

  it("omits blank optional fields and accepts a location object", () => {
    const parsed = createFindingFieldsSchema.parse({
      assetId,
      description: "Cracked cover.",
      zone: "   ",
      locationLabel: "",
      location: "  ",
      reportedBy: "",
      discoveredAt: "",
    });

    expect(parsed.zone).toBeUndefined();
    expect(parsed.locationLabel).toBeUndefined();
    expect(parsed.location).toBeUndefined();
    expect(parsed.reportedBy).toBeUndefined();
    expect(parsed.discoveredAt).toBeUndefined();

    const withObject = createFindingFieldsSchema.parse({
      assetId,
      description: "Cracked cover.",
      location: { bay: "3", nested: { side: "LH" }, readings: [1, 2] },
    });
    expect(withObject.location).toEqual({
      bay: "3",
      nested: { side: "LH" },
      readings: [1, 2],
    });
  });

  it("rejects missing required fields, bad ids, and columns that do not exist", () => {
    expect(
      createFindingFieldsSchema.safeParse({
        description: "Cracked cover.",
      }).success,
    ).toBe(false);
    expect(
      createFindingFieldsSchema.safeParse({
        assetId,
        description: "   ",
      }).success,
    ).toBe(false);
    expect(
      createFindingFieldsSchema.safeParse({
        assetId: "not-a-uuid",
        description: "Cracked cover.",
      }).success,
    ).toBe(false);
    expect(
      createFindingFieldsSchema.safeParse({
        assetId,
        description: "x".repeat(MAX_FINDING_DESCRIPTION_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      createFindingFieldsSchema.safeParse({
        assetId,
        description: "x".repeat(MAX_FINDING_DESCRIPTION_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      createFindingFieldsSchema.safeParse({
        ...fields,
        zone: "z".repeat(MAX_FINDING_ZONE_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      createFindingFieldsSchema.safeParse({
        ...fields,
        reportedBy: "field tech",
      }).success,
    ).toBe(false);
    expect(
      createFindingFieldsSchema.safeParse({
        ...fields,
        discoveredAt: "Tuesday",
      }).success,
    ).toBe(false);

    for (const extra of [
      { summary: "Cracked cover" },
      { title: "Cracked cover" },
      { severity: "high" },
    ]) {
      expect(
        createFindingFieldsSchema.safeParse({ ...fields, ...extra }).success,
      ).toBe(false);
    }
  });

  it("rejects a location that is not a JSON object within the length cap", () => {
    for (const location of ["[]", "null", "12", "not json", '{"bay":']) {
      expect(
        createFindingFieldsSchema.safeParse({
          assetId,
          description: "Cracked cover.",
          location,
        }).success,
      ).toBe(false);
    }

    expect(
      createFindingFieldsSchema.safeParse({
        assetId,
        description: "Cracked cover.",
        location: `{"note":"${"n".repeat(MAX_FINDING_LOCATION_JSON_LENGTH)}"}`,
      }).success,
    ).toBe(false);

    const empty = createFindingFieldsSchema.parse({
      assetId,
      description: "Cracked cover.",
      location: "{}",
    });
    expect(empty.location).toEqual({});
  });
});

describe("findingPhotoSchema", () => {
  it("describes a stored issue_media photo", () => {
    const parsed = findingPhotoSchema.parse({
      ...photo,
      storageKey: `  ${photo.storageKey}  `,
      caption: "  Fastener line  ",
    });

    expect(parsed.mimeType).toBe("image/jpeg");
    expect(parsed.storageKey).toBe(photo.storageKey);
    expect(parsed.caption).toBe("Fastener line");
    expect(findingPhotoSchema.parse(photo).caption).toBeNull();
  });

  it("rejects an alias or a non-image as the stored media type", () => {
    expect(
      findingPhotoSchema.safeParse({ ...photo, mimeType: "image/jpg" }).success,
    ).toBe(false);
    expect(
      findingPhotoSchema.safeParse({ ...photo, mimeType: "image/gif" }).success,
    ).toBe(false);
    expect(
      findingPhotoSchema.safeParse({ ...photo, storageKey: "   " }).success,
    ).toBe(false);
    expect(
      findingPhotoSchema.safeParse({ ...photo, caption: "" }).success,
    ).toBe(false);
    expect(
      findingPhotoSchema.safeParse({ ...photo, mimeType: "image/heic" })
        .success,
    ).toBe(true);
  });
});

describe("createFindingResultSchema", () => {
  const created = {
    id: findingId,
    code: "ISS-1002",
    stage: "discovered" as const,
    createdAt: "2026-10-12T20:15:00.000Z",
    photos: [photo],
  };

  it("accepts the 201 body", () => {
    const parsed = createFindingResultSchema.parse(created);

    expect(parsed.stage).toBe("discovered");
    expect(parsed.code).toBe("ISS-1002");
    expect(parsed.photos).toHaveLength(1);
    expect(findingStageSchema.parse("discovered")).toBe("discovered");
    expect(findingStageSchema.safeParse("submitted").success).toBe(false);
  });

  it("requires discovered and between 1 and 10 photos", () => {
    expect(
      createFindingResultSchema.safeParse({ ...created, stage: "closed" })
        .success,
    ).toBe(false);
    expect(
      createFindingResultSchema.safeParse({ ...created, photos: [] }).success,
    ).toBe(false);
    expect(
      createFindingResultSchema.safeParse({
        ...created,
        photos: Array.from({ length: MAX_FINDING_PHOTOS + 1 }, () => photo),
      }).success,
    ).toBe(false);
    expect(
      createFindingResultSchema.safeParse({
        ...created,
        photos: Array.from({ length: MAX_FINDING_PHOTOS }, () => photo),
      }).success,
    ).toBe(true);
  });
});

describe("finding API errors", () => {
  it("accepts finding codes on apiErrorSchema", () => {
    for (const code of Object.keys(FINDING_ERROR_HTTP_STATUS)) {
      const parsed = apiErrorSchema.parse({
        error: {
          code,
          message: "Request validation failed.",
          ...(code === "validation_failed"
            ? {
                details: [
                  {
                    path: "description",
                    message: "A description is required.",
                  },
                ],
              }
            : {}),
        },
      });

      expect(parsed.error.code).toBe(code);
    }

    expect(FINDING_ERROR_HTTP_STATUS.photo_too_large).toBe(413);
    expect(FINDING_ERROR_HTTP_STATUS.unsupported_photo_type).toBe(415);
    expect(
      apiErrorSchema.safeParse({
        error: { code: "not_a_code", message: "nope" },
      }).success,
    ).toBe(false);
  });
});

describe("findings schema module", () => {
  it("stays free of server imports", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/schemas/findings.ts"),
      "utf8",
    );

    expect(source).not.toContain("server-only");
    expect(source).not.toContain("@/db");
    expect(source).not.toContain("@/server");
  });
});

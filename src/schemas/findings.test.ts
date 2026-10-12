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
import { SEVERITIES } from "@/config/severity";
import { workStage } from "@/db/schema";
import {
  apiErrorSchema,
  createFindingFieldsSchema,
  createFindingResultSchema,
  findingListFiltersSchema,
  findingLocationSchema,
  findingMediaContentSchema,
  findingPhotoMetaSchema,
  findingPhotoSchema,
  findingRecordSchema,
  findingSeveritySchema,
  findingStageSchema,
  initialFindingStageTransitionSchema,
} from "@/schemas";

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const assetId = "550e8400-e29b-41d4-a716-446655440022";
const reporterId = "550e8400-e29b-41d4-a716-446655440011";
const findingId = "550e8400-e29b-41d4-a716-446655440031";
const photoId = "550e8400-e29b-41d4-a716-446655440032";

const fields = {
  assetId,
  description: "The cover is cracked along the fastener line.",
  severity: "high" as const,
  zone: "bay 3",
  locationLabel: "upper fitting",
  location: '{"bay":"3","position":"upper"}',
  reportedBy: reporterId,
  discoveredAt: "2026-10-12T18:04:00.000Z",
};

const storedAt = "2026-10-12T20:15:00.000Z";

const photo = {
  id: photoId,
  issueId: findingId,
  storageKey: `${orgId}/issues/${findingId}/${photoId}`,
  mimeType: "image/jpeg" as const,
  caption: null,
  uploadedBy: null,
  createdAt: storedAt,
  updatedAt: storedAt,
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
    expect(parsed.severity).toBe("high");
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
      severity: "low",
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
      severity: "medium",
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
        severity: "critical",
      }).success,
    ).toBe(true);
    expect(
      createFindingFieldsSchema.safeParse({
        assetId,
        description: "Cracked cover.",
      }).success,
    ).toBe(false);
    for (const severity of SEVERITIES) {
      expect(findingSeveritySchema.parse(severity)).toBe(severity);
    }
    expect(findingSeveritySchema.safeParse("urgent").success).toBe(false);
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
      { notes: "See the photo." },
      { groupId: "10000000-0000-4000-8000-000000000021" },
      { assetGroupId: "10000000-0000-4000-8000-000000000021" },
      { assetGroup: "Demo group" },
      { code: "ISS-1002" },
      { code: "42" },
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
          severity: "high",
          location,
        }).success,
      ).toBe(false);
    }

    expect(
      createFindingFieldsSchema.safeParse({
        assetId,
        description: "Cracked cover.",
        severity: "high",
        location: `{"note":"${"n".repeat(MAX_FINDING_LOCATION_JSON_LENGTH)}"}`,
      }).success,
    ).toBe(false);

    const empty = createFindingFieldsSchema.parse({
      assetId,
      description: "Cracked cover.",
      severity: "high",
      location: "{}",
    });
    expect(empty.location).toEqual({});
  });

  it("caps a location object by JSON.stringify length", () => {
    const wrapper = JSON.stringify({ note: "" });
    const atCap = {
      note: "n".repeat(MAX_FINDING_LOCATION_JSON_LENGTH - wrapper.length),
    };
    const over = {
      note: "n".repeat(MAX_FINDING_LOCATION_JSON_LENGTH - wrapper.length + 1),
    };

    expect(JSON.stringify(atCap)).toHaveLength(
      MAX_FINDING_LOCATION_JSON_LENGTH,
    );
    expect(JSON.stringify(over)).toHaveLength(
      MAX_FINDING_LOCATION_JSON_LENGTH + 1,
    );

    const parsed = createFindingFieldsSchema.parse({
      assetId,
      description: "Cracked cover.",
      severity: "high",
      location: atCap,
    });
    expect(parsed.location).toEqual(atCap);
    expect(
      createFindingFieldsSchema.safeParse({
        assetId,
        description: "Cracked cover.",
        severity: "high",
        location: JSON.stringify(atCap),
      }).success,
    ).toBe(true);
    expect(
      createFindingFieldsSchema.safeParse({
        assetId,
        description: "Cracked cover.",
        severity: "high",
        location: over,
      }).success,
    ).toBe(false);
  });
});

describe("findingPhotoSchema", () => {
  it("maps an issue_media row, including the key ObjectStorage returned", () => {
    const parsed = findingPhotoSchema.parse({
      ...photo,
      storageKey: `  ${photo.storageKey}  `,
      caption: "  Fastener line  ",
    });

    expect(parsed.issueId).toBe(findingId);
    expect(parsed.mimeType).toBe("image/jpeg");
    expect(parsed.storageKey).toBe(photo.storageKey);
    expect(parsed.caption).toBe("Fastener line");
    expect(parsed.uploadedBy).toBeNull();
    expect(findingPhotoSchema.parse(photo).caption).toBeNull();
  });

  it("rejects a column issue_media does not have", () => {
    expect(
      findingPhotoSchema.safeParse({ ...photo, fileName: "bay.jpg" }).success,
    ).toBe(false);
    expect(
      findingPhotoSchema.safeParse({ ...photo, byteLength: 12 }).success,
    ).toBe(false);
    expect(
      findingPhotoSchema.safeParse({ ...photo, issueId: undefined }).success,
    ).toBe(false);
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
    severity: "high" as const,
    createdAt: storedAt,
    photos: [photo],
  };

  it("accepts the 201 body", () => {
    const parsed = createFindingResultSchema.parse(created);

    expect(parsed.stage).toBe("discovered");
    expect(parsed.severity).toBe("high");
    expect(parsed.code).toBe("ISS-1002");
    expect(parsed.photos).toHaveLength(1);
    expect(parsed.photos[0]?.issueId).toBe(findingId);
    expect(findingStageSchema.parse("discovered")).toBe("discovered");
    expect(findingStageSchema.safeParse("submitted").success).toBe(false);
    expect(
      createFindingResultSchema.safeParse({ ...created, code: "ISS-1001" })
        .success,
    ).toBe(true);
  });

  it("records the opening transition as discovered with no previous stage", () => {
    const parsed = initialFindingStageTransitionSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440055",
      issueId: findingId,
      fromStage: null,
      toStage: "discovered",
      changedBy: null,
      changedAt: storedAt,
    });

    expect(parsed.fromStage).toBeNull();
    expect(parsed.toStage).toBe("discovered");
    expect(
      initialFindingStageTransitionSchema.safeParse({
        ...parsed,
        fromStage: "discovered",
      }).success,
    ).toBe(false);
    expect(
      initialFindingStageTransitionSchema.safeParse({
        ...parsed,
        toStage: "analysis",
      }).success,
    ).toBe(false);
  });

  it("requires discovered and between 1 and 10 photos", () => {
    expect(
      createFindingResultSchema.safeParse({ ...created, stage: "closed" })
        .success,
    ).toBe(false);
    expect(
      createFindingResultSchema.safeParse({ ...created, severity: "urgent" })
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
          ...(code === "validation_error"
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

    expect(FINDING_ERROR_HTTP_STATUS.payload_too_large).toBe(413);
    expect(FINDING_ERROR_HTTP_STATUS.unsupported_media_type).toBe(415);
    expect(
      apiErrorSchema.safeParse({
        error: { code: "not_a_code", message: "nope" },
      }).success,
    ).toBe(false);
  });
});

describe("findingStageSchema", () => {
  it("matches the work_stage enum", () => {
    expect(findingStageSchema.options).toEqual([...workStage.enumValues]);
  });
});

describe("findingRecordSchema", () => {
  const record = {
    id: findingId,
    code: "ISS-1002",
    assetId,
    description: "The cover is cracked along the fastener line.",
    severity: "high" as const,
    stage: "discovered" as const,
    zone: "bay 3",
    locationLabel: "upper fitting",
    location: { bay: "3" },
    createdAt: storedAt,
    asset: {
      id: assetId,
      identifier: "CR-1",
      name: "North crane",
      assetGroup: { id: orgId, name: "Yard cranes" },
    },
    photos: [
      {
        mediaId: photoId,
        contentType: "image/jpeg" as const,
        size: null,
        createdAt: storedAt,
      },
    ],
  };

  it("reuses the stage and severity schemas and rejects a title", () => {
    expect(findingRecordSchema.shape.stage).toBe(findingStageSchema);
    expect(findingRecordSchema.shape.severity).toBe(findingSeveritySchema);
    expect(findingRecordSchema.shape.location.unwrap()).toBe(
      findingLocationSchema,
    );
    expect(
      findingRecordSchema.parse({ ...record, location: null }).location,
    ).toBeNull();
    expect([...findingRecordSchema.shape.severity.options]).toEqual([
      ...SEVERITIES,
    ]);

    const parsed = findingRecordSchema.parse(record);
    expect(parsed.photos[0]?.mediaId).toBe(photoId);
    expect(parsed.photos[0]?.contentType).toBe("image/jpeg");
    expect(parsed.photos[0]?.size).toBeNull();
    expect(parsed.photos[0]).not.toHaveProperty("storageKey");
    expect(parsed).not.toHaveProperty("title");
    expect(parsed).not.toHaveProperty("notes");

    expect(
      findingRecordSchema.safeParse({ ...record, title: "Crack" }).success,
    ).toBe(false);
    expect(
      findingRecordSchema.safeParse({ ...record, notes: "see photo" }).success,
    ).toBe(false);
    expect(
      findingPhotoMetaSchema.safeParse({
        ...record.photos[0],
        storageKey: `${orgId}/issues/${findingId}/${photoId}`,
      }).success,
    ).toBe(false);
    expect(
      findingPhotoMetaSchema.safeParse({
        ...record.photos[0],
        url: "https://example.com/photo.jpg",
      }).success,
    ).toBe(false);
    expect(
      findingMediaContentSchema.parse({
        storageKey: `${orgId}/issues/${findingId}/${photoId}`,
        contentType: "image/jpeg",
        size: null,
      }),
    ).toEqual({
      storageKey: `${orgId}/issues/${findingId}/${photoId}`,
      contentType: "image/jpeg",
      size: null,
    });
    expect(findingListFiltersSchema.parse({}).stage).toBeUndefined();
    expect(findingListFiltersSchema.safeParse({ stage: "nope" }).success).toBe(
      false,
    );
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

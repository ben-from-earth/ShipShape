import { describe, expect, it, vi } from "vitest";

import { MAX_FINDING_PHOTO_BYTES, MAX_FINDING_PHOTOS } from "@/config/findings";
import type { ObjectStorage } from "@/server/storage";

import { createFinding, type CreateFindingDependencies } from "./create";
import type { FindingInsert, InsertedFinding } from "./persist";

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const assetId = "550e8400-e29b-41d4-a716-446655440022";
const reporterId = "550e8400-e29b-41d4-a716-446655440011";
const storedAt = "2026-10-12T20:15:00.000Z";

const fields = {
  assetId,
  description: "The cover is cracked along the fastener line.",
  severity: "high",
  zone: "bay 3",
  locationLabel: "upper fitting",
};

function dependencies(
  overrides: Partial<CreateFindingDependencies> = {},
): CreateFindingDependencies & {
  events: string[];
  deleted: string[];
  inserted: FindingInsert[];
} {
  const events: string[] = [];
  const deleted: string[] = [];
  const inserted: FindingInsert[] = [];
  const storage: ObjectStorage = {
    async put(key) {
      events.push(`put:${key}`);
      return { key: `disk/${key}` };
    },
    async get() {
      return null;
    },
    async read() {
      return null;
    },
    async delete(key) {
      deleted.push(key);
    },
  };

  return {
    events,
    deleted,
    inserted,
    storage,
    assetInOrg: vi.fn(async () => {
      events.push("asset");
      return true;
    }),
    reporterInOrg: vi.fn(async () => {
      events.push("reporter");
      return true;
    }),
    insertFinding: vi.fn(async (finding) => {
      events.push("insert");
      inserted.push(finding);
      return insertedFinding(finding);
    }),
    ...overrides,
  };
}

function insertedFinding(finding: FindingInsert): InsertedFinding {
  return {
    id: finding.id,
    code: "ISS-1002",
    stage: "discovered",
    severity: finding.severity,
    createdAt: new Date(storedAt),
    photos: finding.photos.map((photo) => ({
      id: photo.id,
      issueId: finding.id,
      storageKey: photo.storageKey,
      mimeType: photo.mimeType,
      caption: null,
      uploadedBy: null,
      createdAt: new Date(storedAt),
      updatedAt: new Date(storedAt),
    })),
  };
}

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const HEIC_BYTES = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0x00,
  0x00, 0x00, 0x00, 0x6d, 0x69, 0x66, 0x31,
]);

function sampleBytes(fileName: string): Uint8Array {
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (extension === ".png") {
    return PNG_BYTES;
  }
  if (extension === ".heic" || extension === ".heif") {
    return HEIC_BYTES;
  }
  return JPEG_BYTES;
}

function photo(
  fileName = "bay.jpg",
  mediaType = "image/jpeg",
  bytes?: Uint8Array,
) {
  return { fileName, mediaType, bytes: bytes ?? sampleBytes(fileName) };
}

describe("createFinding", () => {
  it("stores org-scoped photos and returns the discovered finding", async () => {
    const deps = dependencies();

    const result = await createFinding(
      {
        orgId,
        fields: {
          ...fields,
          reportedBy: reporterId,
          location: '{"bay":"3"}',
        },
        photos: [
          photo("bay.jpg", "image/jpg"),
          photo("edge.heic", "image/heic"),
        ],
      },
      deps,
    );

    expect(deps.events[0]).toBe("reporter");
    expect(deps.events[1]).toBe("asset");
    expect(deps.events.at(-1)).toBe("insert");
    expect(deps.deleted).toEqual([]);
    expect(result.code).toBe("ISS-1002");
    expect(result.stage).toBe("discovered");
    expect(result.severity).toBe("high");
    expect(result.createdAt).toBe(storedAt);
    expect(result.photos).toHaveLength(2);
    expect(result.photos[0]?.mimeType).toBe("image/jpeg");
    expect(result.photos[1]?.mimeType).toBe("image/heic");
    expect(result.photos[0]?.caption).toBeNull();
    expect(result.photos[0]?.uploadedBy).toBeNull();
    expect(result.photos[0]?.storageKey).toBe(
      `disk/${orgId}/issues/${result.id}/${result.photos[0]?.id}`,
    );

    const stored = deps.inserted[0];
    expect(stored?.assetId).toBe(assetId);
    expect(stored?.severity).toBe("high");
    expect(stored?.zone).toBe("bay 3");
    expect(stored?.locationLabel).toBe("upper fitting");
    expect(stored?.location).toEqual({ bay: "3" });
    expect(stored?.reportedBy).toBe(reporterId);
    expect(stored?.photos.map((item) => item.mimeType)).toEqual([
      "image/jpeg",
      "image/heic",
    ]);
  });

  it("rejects invalid fields before looking up the asset or storing photos", async () => {
    const missing = dependencies();
    await expect(
      createFinding(
        {
          orgId,
          fields: { assetId, severity: "high" },
          photos: [photo()],
        },
        missing,
      ),
    ).rejects.toMatchObject({ code: "validation_error", status: 400 });

    const notes = dependencies();
    await expect(
      createFinding(
        {
          orgId,
          fields: { ...fields, notes: "See the photo." },
          photos: [photo()],
        },
        notes,
      ),
    ).rejects.toMatchObject({ code: "validation_error", status: 400 });

    const unknownReporter = dependencies({
      reporterInOrg: async () => false,
    });
    await expect(
      createFinding(
        {
          orgId,
          fields: { ...fields, reportedBy: reporterId },
          photos: [photo()],
        },
        unknownReporter,
      ),
    ).rejects.toMatchObject({
      code: "validation_error",
      status: 400,
      details: [
        {
          path: "reportedBy",
          message: "reportedBy must be a user in this organization.",
        },
      ],
    });

    expect(missing.events).toEqual([]);
    expect(notes.events).toEqual([]);
    expect(unknownReporter.events).toEqual([]);
  });

  it("returns asset_not_found when the asset is not in the organization", async () => {
    const deps = dependencies({
      assetInOrg: async () => false,
    });

    await expect(
      createFinding({ orgId, fields, photos: [photo()] }, deps),
    ).rejects.toMatchObject({ code: "asset_not_found", status: 404 });
    expect(deps.events).toEqual([]);
  });

  it("rejects photo count, size, and type before any write", async () => {
    const none = dependencies();
    await expect(
      createFinding({ orgId, fields, photos: [] }, none),
    ).rejects.toMatchObject({ code: "validation_error", status: 400 });

    const tooMany = dependencies();
    await expect(
      createFinding(
        {
          orgId,
          fields,
          photos: Array.from({ length: MAX_FINDING_PHOTOS + 1 }, () => photo()),
        },
        tooMany,
      ),
    ).rejects.toMatchObject({ code: "too_many_photos", status: 400 });

    const tooLarge = dependencies();
    await expect(
      createFinding(
        {
          orgId,
          fields,
          photos: [
            photo(
              "bay.jpg",
              "image/jpeg",
              new Uint8Array(MAX_FINDING_PHOTO_BYTES + 1),
            ),
          ],
        },
        tooLarge,
      ),
    ).rejects.toMatchObject({ code: "payload_too_large", status: 413 });

    const wrongType = dependencies();
    await expect(
      createFinding(
        {
          orgId,
          fields,
          photos: [photo("bay.gif", "image/gif")],
        },
        wrongType,
      ),
    ).rejects.toMatchObject({ code: "unsupported_media_type", status: 415 });

    const mismatch = dependencies();
    await expect(
      createFinding(
        {
          orgId,
          fields,
          photos: [photo("bay.jpg", "image/png")],
        },
        mismatch,
      ),
    ).rejects.toMatchObject({
      code: "unsupported_media_type",
      status: 415,
      message: "The file extension does not match its media type.",
    });

    const disguised = dependencies();
    await expect(
      createFinding(
        {
          orgId,
          fields,
          photos: [photo("bay.jpg", "image/jpeg", PNG_BYTES)],
        },
        disguised,
      ),
    ).rejects.toMatchObject({
      code: "unsupported_media_type",
      status: 415,
      message: "The file contents do not match its media type.",
    });

    for (const deps of [
      none,
      tooMany,
      tooLarge,
      wrongType,
      mismatch,
      disguised,
    ]) {
      expect(deps.events.filter((event) => event.startsWith("put"))).toEqual(
        [],
      );
      expect(deps.inserted).toEqual([]);
    }
    expect(none.events).toEqual(["asset"]);
    expect(tooMany.events).toEqual(["asset"]);
  });

  it("deletes stored photos when the insert fails", async () => {
    const deps = dependencies({
      insertFinding: async () => {
        throw new Error("database unavailable");
      },
    });

    await expect(
      createFinding(
        { orgId, fields, photos: [photo(), photo("edge.png", "image/png")] },
        deps,
      ),
    ).rejects.toThrow(/database unavailable/);
    expect(deps.deleted).toHaveLength(2);
    expect(
      deps.deleted.every((key) => key.startsWith(`disk/${orgId}/issues/`)),
    ).toBe(true);
  });

  it("deletes photos already stored when a later put fails", async () => {
    let puts = 0;
    const deps = dependencies({
      storage: {
        async put() {
          puts += 1;
          if (puts > 1) {
            throw new Error("disk full");
          }
          return { key: "disk/first" };
        },
        async get() {
          return null;
        },
        async read() {
          return null;
        },
        async delete(key) {
          deps.deleted.push(key);
        },
      },
    });

    await expect(
      createFinding(
        { orgId, fields, photos: [photo(), photo("edge.png", "image/png")] },
        deps,
      ),
    ).rejects.toThrow(/disk full/);
    expect(deps.deleted).toEqual(["disk/first"]);
    expect(deps.inserted).toEqual([]);
  });
});

import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/db";
import type { ObjectStorage } from "@/server/storage";

import {
  FINDING_PHOTO_NOT_FOUND_MESSAGE,
  FindingPhotoNotFoundError,
  findFindingPhoto,
  openFindingPhoto,
  type FindingPhotoRecord,
  type OpenFindingPhotoInput,
} from "./photo";

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const otherOrgId = "550e8400-e29b-41d4-a716-446655440099";
const findingId = "550e8400-e29b-41d4-a716-446655440031";
const otherFindingId = "550e8400-e29b-41d4-a716-446655440041";
const mediaId = "550e8400-e29b-41d4-a716-446655440032";
const otherMediaId = "550e8400-e29b-41d4-a716-446655440042";
const bytes = new Uint8Array([1, 2, 3, 4]);

function streamOf(body: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    },
  });
}

function photoKey(input: OpenFindingPhotoInput): string {
  return `${input.orgId}/${input.findingId}/${input.mediaId}`;
}

function dependencies(
  library: Map<string, FindingPhotoRecord>,
  read: ObjectStorage["read"] = vi.fn(async () => streamOf(bytes)),
) {
  const storage = {
    async put(key: string) {
      return { key };
    },
    async get() {
      return null;
    },
    read,
    async delete() {},
  } satisfies ObjectStorage;

  return {
    storage,
    findPhoto: async (input: OpenFindingPhotoInput) =>
      library.get(photoKey(input)) ?? null,
  };
}

describe("findFindingPhoto", () => {
  it("requires the asset organization and the finding on the media row", async () => {
    let where: unknown;
    const joins: unknown[] = [];
    const chain = {
      from() {
        return chain;
      },
      innerJoin(_table: unknown, condition: unknown) {
        joins.push(condition);
        return chain;
      },
      where(condition: unknown) {
        where = condition;
        return chain;
      },
      async limit() {
        return [
          {
            storageKey: `${orgId}/issues/${findingId}/${mediaId}`,
            mimeType: "image/jpeg",
          },
        ];
      },
    };
    const db = {
      select() {
        return chain;
      },
    } as unknown as Database;

    const row = await findFindingPhoto(db, {
      orgId,
      findingId,
      mediaId,
    });

    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(
      where as Parameters<PgDialect["sqlToQuery"]>[0],
    );
    const joinSql = joins.map(
      (condition) =>
        dialect.sqlToQuery(condition as Parameters<PgDialect["sqlToQuery"]>[0])
          .sql,
    );
    expect(query.sql).toContain("org_id");
    expect(query.sql).toContain('"issues"."id"');
    expect(query.sql).toContain('"issue_media"."id"');
    expect(joinSql.some((sql) => sql.includes("issue_id"))).toBe(true);
    expect(query.params).toEqual([mediaId, findingId, orgId]);
    expect(row).toEqual({
      storageKey: `${orgId}/issues/${findingId}/${mediaId}`,
      mimeType: "image/jpeg",
    });
  });
});

describe("openFindingPhoto", () => {
  const library = new Map<string, FindingPhotoRecord>([
    [
      photoKey({ orgId, findingId, mediaId }),
      { storageKey: "stored/photo", mimeType: "image/jpeg" },
    ],
  ]);

  it("streams the stored object with its media type", async () => {
    const read = vi.fn(async () => streamOf(bytes));
    const result = await openFindingPhoto(
      { orgId, findingId, mediaId },
      dependencies(library, read),
    );
    const body = new Uint8Array(
      await new Response(result.stream).arrayBuffer(),
    );

    expect(read).toHaveBeenCalledWith("stored/photo");
    expect(result.mediaType).toBe("image/jpeg");
    expect(body).toEqual(bytes);
  });

  it("returns the same not_found for another organization", async () => {
    const read = vi.fn(async () => streamOf(bytes));
    const error = await openFindingPhoto(
      { orgId: otherOrgId, findingId, mediaId },
      dependencies(library, read),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(FindingPhotoNotFoundError);
    expect(error).toMatchObject({
      code: "not_found",
      status: 404,
      message: FINDING_PHOTO_NOT_FOUND_MESSAGE,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("returns the same not_found when the media is on another finding", async () => {
    const read = vi.fn(async () => streamOf(bytes));
    const mismatchedMedia = await openFindingPhoto(
      { orgId, findingId, mediaId: otherMediaId },
      dependencies(library, read),
    ).catch((caught: unknown) => caught);
    const mismatchedFinding = await openFindingPhoto(
      { orgId, findingId: otherFindingId, mediaId },
      dependencies(library, read),
    ).catch((caught: unknown) => caught);

    expect(mismatchedMedia).toMatchObject({
      code: "not_found",
      status: 404,
      message: FINDING_PHOTO_NOT_FOUND_MESSAGE,
    });
    expect(mismatchedFinding).toMatchObject({
      code: "not_found",
      status: 404,
      message: FINDING_PHOTO_NOT_FOUND_MESSAGE,
    });
    expect(read).not.toHaveBeenCalled();
  });
});

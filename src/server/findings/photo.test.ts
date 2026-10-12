import { beforeEach, describe, expect, it, vi } from "vitest";

import { getFindingMedia } from "@/features/findings/data";
import type { FindingMediaContent } from "@/schemas";
import type { ObjectStorage } from "@/server/storage";

import {
  FINDING_PHOTO_NOT_FOUND_MESSAGE,
  FindingPhotoNotFoundError,
  openFindingPhoto,
} from "./photo";

vi.mock("@/features/findings/data", () => ({
  getFindingMedia: vi.fn(),
}));

const findingId = "550e8400-e29b-41d4-a716-446655440031";
const otherFindingId = "550e8400-e29b-41d4-a716-446655440041";
const mediaId = "550e8400-e29b-41d4-a716-446655440032";
const otherMediaId = "550e8400-e29b-41d4-a716-446655440042";
const bytes = new Uint8Array([1, 2, 3, 4]);

const readMedia = vi.mocked(getFindingMedia);

function streamOf(body: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(body);
      controller.close();
    },
  });
}

function storageWith(
  read: ObjectStorage["read"] = vi.fn(async () => streamOf(bytes)),
): ObjectStorage {
  return {
    async put(key: string) {
      return { key };
    },
    async get() {
      return null;
    },
    read,
    async delete() {},
  };
}

const stored: FindingMediaContent = {
  storageKey: "stored/photo",
  contentType: "image/jpeg",
  size: null,
};

beforeEach(() => {
  readMedia.mockReset();
  readMedia.mockResolvedValue(stored);
});

describe("openFindingPhoto", () => {
  it("streams the object from getFindingMedia with its content type", async () => {
    const read = vi.fn(async () => streamOf(bytes));
    const result = await openFindingPhoto(
      { findingId, mediaId },
      { storage: storageWith(read) },
    );
    const body = new Uint8Array(
      await new Response(result.stream).arrayBuffer(),
    );

    expect(readMedia).toHaveBeenCalledWith(findingId, mediaId);
    expect(read).toHaveBeenCalledWith("stored/photo");
    expect(result.mediaType).toBe("image/jpeg");
    expect(body).toEqual(bytes);
  });

  it("returns the same not_found when getFindingMedia returns null for another organization", async () => {
    readMedia.mockResolvedValue(null);
    const read = vi.fn(async () => streamOf(bytes));
    const error = await openFindingPhoto(
      { findingId, mediaId },
      { storage: storageWith(read) },
    ).catch((caught: unknown) => caught);

    expect(readMedia).toHaveBeenCalledWith(findingId, mediaId);
    expect(error).toBeInstanceOf(FindingPhotoNotFoundError);
    expect(error).toMatchObject({
      code: "not_found",
      status: 404,
      message: FINDING_PHOTO_NOT_FOUND_MESSAGE,
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("returns the same not_found when the media is on another finding", async () => {
    readMedia.mockResolvedValue(null);
    const read = vi.fn(async () => streamOf(bytes));
    const storage = storageWith(read);
    const mismatchedMedia = await openFindingPhoto(
      { findingId, mediaId: otherMediaId },
      { storage },
    ).catch((caught: unknown) => caught);
    const mismatchedFinding = await openFindingPhoto(
      { findingId: otherFindingId, mediaId },
      { storage },
    ).catch((caught: unknown) => caught);

    expect(readMedia).toHaveBeenNthCalledWith(1, findingId, otherMediaId);
    expect(readMedia).toHaveBeenNthCalledWith(2, otherFindingId, mediaId);
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

  it("returns the same not_found when the stored object is missing", async () => {
    const read = vi.fn(async () => null);
    const error = await openFindingPhoto(
      { findingId, mediaId },
      { storage: storageWith(read) },
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: "not_found",
      status: 404,
      message: FINDING_PHOTO_NOT_FOUND_MESSAGE,
    });
    expect(read).toHaveBeenCalledWith("stored/photo");
  });

  it("rejects a non-uuid before calling getFindingMedia", async () => {
    const read = vi.fn(async () => streamOf(bytes));
    const error = await openFindingPhoto(
      { findingId: "not-a-uuid", mediaId },
      { storage: storageWith(read) },
    ).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "validation_error", status: 400 });
    expect(readMedia).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
});

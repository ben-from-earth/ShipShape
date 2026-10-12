import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readStoredLocation,
  readStoredMediaContent,
  readStoredPhoto,
} from "./coerce";

const findingId = "550e8400-e29b-41d4-a716-446655440031";
const mediaId = "550e8400-e29b-41d4-a716-446655440032";
const createdAt = "2026-10-12T20:15:00.000Z";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readStoredLocation", () => {
  it("keeps a JSON object, including an empty one, without a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(readStoredLocation(findingId, { bay: "3" })).toEqual({ bay: "3" });
    expect(readStoredLocation(findingId, {})).toEqual({});
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns null and warns when the value is not an object", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(readStoredLocation(findingId, ["not", "an", "object"])).toBeNull();
    expect(readStoredLocation(findingId, "upper fitting")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      `Finding ${findingId} location is not a JSON object; returning null.`,
    );
  });
});

describe("readStoredPhoto", () => {
  it("keeps a stored photo type", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      readStoredPhoto({
        id: mediaId,
        issueId: findingId,
        mimeType: "image/jpeg",
        createdAt,
      }),
    ).toEqual({
      mediaId,
      contentType: "image/jpeg",
      size: null,
      createdAt,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("skips an unexpected mime type and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      readStoredPhoto({
        id: mediaId,
        issueId: findingId,
        mimeType: "image/gif",
        createdAt,
      }),
    ).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      `Skipping issue_media ${mediaId} on finding ${findingId}: mime type image/gif is not a stored photo type.`,
    );
  });
});

describe("readStoredMediaContent", () => {
  it("returns null for an unexpected mime type", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(
      readStoredMediaContent({
        findingId,
        mediaId,
        storageKey: `${findingId}/${mediaId}`,
        mimeType: "image/gif",
      }),
    ).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});

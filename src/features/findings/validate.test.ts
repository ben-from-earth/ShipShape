import { describe, expect, it } from "vitest";

import { MAX_FINDING_PHOTO_BYTES, MAX_FINDING_PHOTOS } from "./contract";
import { fieldLabels } from "./labels";
import { findingErrors } from "./validate";
import type { FindingDraft } from "./validate";

const valid: FindingDraft = {
  assetId: "10000000-0000-4000-8000-000000000022",
  title: "Cracked support",
  description: "The support is cracked beside the access hatch.",
  severity: "high",
  zone: "bay 2",
  locationLabel: "Frame 12",
  photos: [],
};

describe("findingErrors", () => {
  it("accepts a complete finding", () => {
    expect(findingErrors(valid)).toEqual({});
  });

  it("requires an asset, a title, a description, and a severity", () => {
    expect(
      findingErrors({
        ...valid,
        assetId: "",
        title: "  ",
        description: "",
        severity: "",
      }),
    ).toMatchObject({
      assetId: "Choose an asset.",
      title: "Enter a title.",
      description: "Describe the finding.",
      severity: "Choose a severity.",
    });
  });

  it("requires one of low, medium, high, or critical", () => {
    expect(findingErrors({ ...valid, severity: "critical" })).toEqual({});
    expect(findingErrors({ ...valid, severity: "urgent" }).severity).toBe(
      "Choose a severity.",
    );
  });

  it("requires a location or a zone", () => {
    expect(findingErrors({ ...valid, zone: " ", locationLabel: "" })).toEqual({
      place: "Enter a location or a zone.",
    });
    expect(
      findingErrors({ ...valid, zone: "", locationLabel: "Frame 4" }),
    ).toEqual({});
  });

  it("rejects a photo of the wrong type, an oversized photo, and too many photos", () => {
    expect(
      findingErrors({
        ...valid,
        photos: [{ name: "notes.pdf", type: "application/pdf", size: 12 }],
      }).photos,
    ).toBe("Photo type not supported.");

    expect(
      findingErrors({
        ...valid,
        photos: [
          {
            name: "crack.jpg",
            type: "image/jpeg",
            size: MAX_FINDING_PHOTO_BYTES + 1,
          },
        ],
      }).photos,
    ).toBe("Photo too large.");

    expect(
      findingErrors({
        ...valid,
        photos: Array.from({ length: MAX_FINDING_PHOTOS + 1 }, () => ({
          name: "crack.jpg",
          type: "image/jpeg",
          size: 20,
        })),
      }).photos,
    ).toBe(`Add up to ${MAX_FINDING_PHOTOS} photos.`);
  });
});

describe("fieldLabels", () => {
  it("defaults to Identifier and Location", () => {
    expect(fieldLabels(null)).toEqual({
      identifier: "Identifier",
      location: "Location",
    });
    expect(fieldLabels("aircraft")).toEqual({
      identifier: "Identifier",
      location: "Location",
    });
    expect(fieldLabels("bridge")).toEqual({
      identifier: "Structure id",
      location: "Span",
    });
  });
});

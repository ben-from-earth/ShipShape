import { describe, expect, it } from "vitest";

import { MAX_FINDING_PHOTO_BYTES, MAX_FINDING_PHOTOS } from "@/config/findings";

import { fieldLabels } from "./labels";
import { findingErrors } from "./validate";
import type { FindingDraft } from "./validate";

const photo = {
  name: "crack.jpg",
  type: "image/jpeg",
  size: 40,
};

const valid: FindingDraft = {
  assetId: "10000000-0000-4000-8000-000000000022",
  description: "The support is cracked beside the access hatch.",
  severity: "high",
  zone: "bay 2",
  locationLabel: "Frame 12",
  photos: [photo],
};

describe("findingErrors", () => {
  it("accepts a complete finding", () => {
    expect(findingErrors(valid)).toEqual({});
  });

  it("requires an asset, a description, a severity, and a photo", () => {
    expect(
      findingErrors({
        ...valid,
        assetId: "",
        description: "",
        severity: "",
        photos: [],
      }),
    ).toMatchObject({
      assetId: "Choose an asset.",
      description: "Describe the finding.",
      severity: "Choose a severity.",
      photos: "Add a photo.",
    });
  });

  it("requires one of low, medium, high, or critical", () => {
    expect(findingErrors({ ...valid, severity: "critical" })).toEqual({});
    expect(findingErrors({ ...valid, severity: "urgent" }).severity).toBe(
      "Choose a severity.",
    );
  });

  it("allows a blank zone and location", () => {
    expect(findingErrors({ ...valid, zone: " ", locationLabel: "" })).toEqual(
      {},
    );
  });

  it("accepts the jpeg alias when the file name agrees", () => {
    expect(
      findingErrors({
        ...valid,
        photos: [{ name: "crack.jpeg", type: "image/jpg", size: 20 }],
      }),
    ).toEqual({});
  });

  it("rejects a photo of the wrong type, an empty photo, an oversized photo, and too many photos", () => {
    expect(
      findingErrors({
        ...valid,
        photos: [{ name: "notes.pdf", type: "application/pdf", size: 12 }],
      }).photos,
    ).toBe("Photo type not supported.");

    expect(
      findingErrors({
        ...valid,
        photos: [{ name: "crack.png", type: "image/jpeg", size: 12 }],
      }).photos,
    ).toBe("Photo type not supported.");

    expect(
      findingErrors({
        ...valid,
        photos: [{ name: "crack.jpg", type: "image/jpeg", size: 0 }],
      }).photos,
    ).toBe("Photo is empty.");

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
        photos: Array.from({ length: MAX_FINDING_PHOTOS + 1 }, () => photo),
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

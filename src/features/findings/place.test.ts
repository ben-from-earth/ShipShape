import { describe, expect, it } from "vitest";

import { findingLocationLine, findingZoneLine, locationText } from "./place";

describe("locationText", () => {
  it("omits a null, empty, or unusable location", () => {
    expect(locationText(null)).toBeNull();
    expect(locationText(undefined)).toBeNull();
    expect(locationText({})).toBeNull();
    expect(locationText([])).toBeNull();
    expect(locationText("FS 171")).toBeNull();
  });

  it("joins the fields of an object", () => {
    expect(locationText({ side: "LH", station: "171" })).toBe(
      "side: LH, station: 171",
    );
  });
});

describe("finding place lines", () => {
  it("shows a dash when zone and location are missing", () => {
    expect(findingZoneLine(null)).toBe("—");
    expect(findingZoneLine("  ")).toBe("—");
    expect(findingLocationLine({ locationLabel: null, location: null })).toBe(
      "—",
    );
    expect(findingLocationLine({ locationLabel: "", location: {} })).toBe("—");
  });

  it("prefers the location label and otherwise the object", () => {
    expect(
      findingLocationLine({
        locationLabel: "LH canopy sill",
        location: null,
      }),
    ).toBe("LH canopy sill");
    expect(
      findingLocationLine({
        locationLabel: null,
        location: { side: "LH" },
      }),
    ).toBe("side: LH");
    expect(findingZoneLine("bay 2")).toBe("bay 2");
  });
});

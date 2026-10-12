import { describe, expect, it } from "vitest";

import { repairAssetLabel } from "./display";

describe("repairAssetLabel", () => {
  it("shows the name when the asset has one", () => {
    expect(repairAssetLabel({ identifier: "A-0022", name: "Fitting" })).toBe(
      "Fitting",
    );
    expect(
      repairAssetLabel({ identifier: "A-0022", name: "  Fitting  " }),
    ).toBe("Fitting");
  });

  it("shows the identifier when the name is missing or blank", () => {
    expect(repairAssetLabel({ identifier: "A-0022", name: null })).toBe(
      "A-0022",
    );
    expect(repairAssetLabel({ identifier: "A-0022", name: "  " })).toBe(
      "A-0022",
    );
    expect(repairAssetLabel({ identifier: "  A-0022  ", name: null })).toBe(
      "A-0022",
    );
  });

  it("shows a dash when both the name and identifier are blank", () => {
    expect(repairAssetLabel({ identifier: " ", name: null })).toBe("—");
    expect(repairAssetLabel({ identifier: "", name: "" })).toBe("—");
  });
});

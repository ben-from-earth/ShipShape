import { describe, expect, it } from "vitest";

import { UPCOMING_TOOLS } from "@/config/tools";

const mockupNames = [
  "Layer Loads",
  "Lug Analysis",
  "Doubler Sizer",
  "Corrosion Blend-out",
  "Fitting Factor Check",
  "CrackGrow Pro",
  "Panel Buckle",
  "Bonded Joint Studio",
  "FEM Bridge",
  "Allowables Library",
  "Fatigue Spectrum Builder",
  "Shear Clip Rater",
  "Damage Tolerance Kit",
  "Truck Frame Checker",
  "Composite Ply Mapper",
  "Weld Seam Assessor",
  "Report Formatter",
];

describe("UPCOMING_TOOLS", () => {
  it("lists each mockup tool once", () => {
    const names = UPCOMING_TOOLS.map((tool) => tool.name);

    expect(names).toEqual(mockupNames);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(UPCOMING_TOOLS.map((tool) => tool.id)).size).toBe(
      names.length,
    );
  });
});

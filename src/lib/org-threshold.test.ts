import { describe, expect, it } from "vitest";

import { LOW_MARGIN_THRESHOLD } from "@/config/analysis";

import { thresholdFromColumn } from "./org-threshold";

describe("thresholdFromColumn", () => {
  it("reads a numeric column and falls back to 0.10", () => {
    expect(thresholdFromColumn("0.25")).toBe(0.25);
    expect(thresholdFromColumn("0.10")).toBe(LOW_MARGIN_THRESHOLD);
    expect(thresholdFromColumn(null)).toBe(LOW_MARGIN_THRESHOLD);
    expect(thresholdFromColumn(undefined)).toBe(LOW_MARGIN_THRESHOLD);
    expect(thresholdFromColumn("")).toBe(LOW_MARGIN_THRESHOLD);
    expect(thresholdFromColumn("nope")).toBe(LOW_MARGIN_THRESHOLD);
  });
});

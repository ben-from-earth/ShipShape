import { describe, expect, it } from "vitest";

import { SEVERITIES } from "@/config/severity";
import { findingListFiltersSchema, findingStageSchema } from "@/schemas";

import { findingFiltersFromSearchParams } from "./search-params";

const ASSET_ID = "10000000-0000-4000-8000-000000000022";

describe("findingFiltersFromSearchParams", () => {
  it("keeps a known stage, a severity, and a uuid asset id", () => {
    const filters = findingFiltersFromSearchParams({
      stage: "discovered",
      severity: "high",
      assetId: ASSET_ID,
    });

    expect(filters).toEqual({
      stage: "discovered",
      severity: "high",
      assetId: ASSET_ID,
    });
    expect(findingListFiltersSchema.parse(filters)).toEqual(filters);
  });

  it("accepts every severity and every stage", () => {
    for (const severity of SEVERITIES) {
      expect(findingFiltersFromSearchParams({ severity }).severity).toBe(
        severity,
      );
    }
    for (const stage of findingStageSchema.options) {
      expect(findingFiltersFromSearchParams({ stage }).stage).toBe(stage);
    }
  });

  it("drops a malformed asset id, severity, or stage instead of throwing", () => {
    expect(() =>
      findingFiltersFromSearchParams({
        stage: "nope",
        severity: "urgent",
        assetId: "not-a-uuid",
      }),
    ).not.toThrow();

    expect(
      findingFiltersFromSearchParams({
        stage: "nope",
        severity: "urgent",
        assetId: "not-a-uuid",
      }),
    ).toEqual({});
    expect(
      findingListFiltersSchema.parse(
        findingFiltersFromSearchParams({ assetId: "buno-1" }),
      ),
    ).toEqual({});
  });

  it("drops blank values and reads the first entry of a repeated param", () => {
    expect(
      findingFiltersFromSearchParams({
        stage: ["", "analysis"],
        severity: "  ",
        assetId: ["not-a-uuid", ASSET_ID],
      }),
    ).toEqual({ stage: "analysis" });
  });
});

import { describe, expect, it } from "vitest";

import { REPAIR_STATUSES } from "@/config/repairs";
import { repairListFiltersSchema } from "@/schemas";

import { repairFiltersFromSearchParams } from "./search-params";

const FINDING_ID = "10000000-0000-4000-8000-000000000031";

describe("repairFiltersFromSearchParams", () => {
  it("keeps a known status and a uuid finding id", () => {
    const filters = repairFiltersFromSearchParams({
      status: "in_review",
      findingId: FINDING_ID,
    });

    expect(filters).toEqual({
      status: "in_review",
      findingId: FINDING_ID,
    });
    expect(repairListFiltersSchema.parse(filters)).toEqual(filters);
  });

  it("accepts every repair status", () => {
    for (const status of REPAIR_STATUSES) {
      expect(repairFiltersFromSearchParams({ status }).status).toBe(status);
    }
  });

  it("drops a malformed status or finding id instead of throwing", () => {
    expect(() =>
      repairFiltersFromSearchParams({
        status: "closed",
        findingId: "not-a-uuid",
      }),
    ).not.toThrow();

    expect(
      repairFiltersFromSearchParams({
        status: "closed",
        findingId: "not-a-uuid",
      }),
    ).toEqual({});
    expect(
      repairListFiltersSchema.parse(
        repairFiltersFromSearchParams({ findingId: "REP-1001" }),
      ),
    ).toEqual({});
  });

  it("drops blank values and reads the first entry of a repeated param", () => {
    expect(
      repairFiltersFromSearchParams({
        status: ["", "open"],
        findingId: ["not-a-uuid", FINDING_ID],
      }),
    ).toEqual({ status: "open" });
    expect(
      repairFiltersFromSearchParams({
        status: ["nope", "completed"],
        findingId: "  ",
      }),
    ).toEqual({});
  });
});

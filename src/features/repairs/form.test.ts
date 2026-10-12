import { describe, expect, it } from "vitest";

import {
  MAX_REPAIR_TITLE_LENGTH,
  MAX_REPAIR_TYPE_LENGTH,
} from "@/config/repairs";
import { REPAIR_STATUSES } from "@/config/repairs";
import { createRepairFieldsSchema } from "@/schemas";

import { repairFormErrors, toRepairFields } from "./form";

describe("repairFormErrors", () => {
  it("accepts a title and omits blank type and status", () => {
    const draft = { title: "  Replace the seal  ", type: "  ", status: "" };

    expect(repairFormErrors(draft)).toEqual({});
    expect(toRepairFields(draft)).toEqual({ title: "Replace the seal" });
    expect(createRepairFieldsSchema.parse(toRepairFields(draft))).toEqual({
      title: "Replace the seal",
    });
  });

  it("accepts every status and an optional type", () => {
    for (const status of REPAIR_STATUSES) {
      expect(
        repairFormErrors({ title: "Replace the seal", type: "weld", status }),
      ).toEqual({});
      expect(
        toRepairFields({ title: "Replace the seal", type: "weld", status }),
      ).toEqual({ title: "Replace the seal", type: "weld", status });
    }
  });

  it("requires a title", () => {
    expect(repairFormErrors({ title: "", type: "", status: "" })).toEqual({
      title: "A title is required.",
    });
    expect(repairFormErrors({ title: "   ", type: "", status: "" })).toEqual({
      title: "A title is required.",
    });
  });

  it("rejects a title or type that is too long and a status outside the list", () => {
    expect(
      repairFormErrors({
        title: "a".repeat(MAX_REPAIR_TITLE_LENGTH + 1),
        type: "b".repeat(MAX_REPAIR_TYPE_LENGTH + 1),
        status: "published",
      }),
    ).toEqual({
      title: "Title is too long.",
      type: "Type is too long.",
      status: "Choose a status.",
    });
  });
});

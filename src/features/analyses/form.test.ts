import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { analysisFormErrors, toAnalysisFields } from "./form";

const empty = {
  title: "",
  method: "",
  loadCase: "",
  margin: "",
  status: "",
  dueDate: "",
  revision: "",
};

describe("analysisFormErrors", () => {
  it("accepts a title and omits a blank due date", () => {
    const draft = {
      ...empty,
      title: "  Check the joint  ",
    };
    expect(analysisFormErrors(draft)).toEqual({});
    expect(toAnalysisFields(draft)).toEqual({
      title: "Check the joint",
    });
  });

  it("keeps a due date when it is set and drops retired fields", () => {
    expect(
      toAnalysisFields({
        title: "Check the joint",
        method: " Hand calculation ",
        loadCase: " Limit load ",
        margin: "0.18",
        status: "in_review",
        dueDate: " 2026-12-01 ",
        revision: " A ",
      }),
    ).toEqual({
      title: "Check the joint",
      dueDate: "2026-12-01",
    });
  });

  it("requires a title and rejects a bad date", () => {
    expect(analysisFormErrors(empty)).toEqual({
      title: "A title is required.",
    });
    expect(
      analysisFormErrors({
        ...empty,
        title: "Check the joint",
        dueDate: "December",
      }),
    ).toEqual({
      dueDate: "Use YYYY-MM-DD.",
    });
  });

  it("imports analysisCreateBodySchema", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "form.ts"),
      "utf8",
    );
    expect(source).toContain("analysisCreateBodySchema");
    expect(source).toContain('from "@/schemas"');
    expect(source).not.toContain("export const analysisCreateBodySchema");
    expect(source).not.toContain(".omit(");
    const fields = toAnalysisFields({
      ...empty,
      title: "Check the joint",
    });
    expect(Object.keys(fields).sort()).toEqual(["title"]);
    expect(fields).not.toHaveProperty("repairId");
    expect(fields).not.toHaveProperty("margin");
  });
});

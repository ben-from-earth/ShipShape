import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ANALYSIS_CONCLUSIONS,
  analysisFormErrors,
  toAnalysisFields,
} from "./form";

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
  it("accepts a title and margin and omits blank optionals", () => {
    const draft = {
      ...empty,
      title: "  Check the joint  ",
      margin: " 0 ",
    };
    expect(analysisFormErrors(draft)).toEqual({});
    expect(toAnalysisFields(draft)).toEqual({
      title: "Check the joint",
      margin: 0,
    });
  });

  it("keeps the optional create fields when they are set", () => {
    expect(
      toAnalysisFields({
        title: "Check the joint",
        method: " Hand calculation ",
        loadCase: " Limit load ",
        margin: "0.18",
        status: "in_review",
        dueDate: "2026-12-01",
        revision: " A ",
      }),
    ).toEqual({
      title: "Check the joint",
      method: "Hand calculation",
      loadCase: "Limit load",
      margin: 0.18,
      status: "in_review",
      dueDate: "2026-12-01",
      revision: "A",
    });
  });

  it("requires a title and a margin and rejects a bad status or date", () => {
    expect(analysisFormErrors(empty)).toEqual({
      title: "A title is required.",
      margin: "A margin is required.",
    });
    expect(
      analysisFormErrors({
        ...empty,
        title: "Check the joint",
        margin: "low",
        status: "published",
        dueDate: "December",
      }),
    ).toEqual({
      margin: "Enter a margin.",
      status: "Choose a status.",
      dueDate: "Use YYYY-MM-DD.",
    });
  });

  it("imports analysisCreateBodySchema and requires a margin", () => {
    expect(ANALYSIS_CONCLUSIONS).toEqual([
      "adequate",
      "inadequate",
      "inconclusive",
    ]);
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
      margin: "0.18",
    });
    expect(Object.keys(fields).sort()).toEqual(["margin", "title"]);
    expect(fields).not.toHaveProperty("repairId");
  });
});

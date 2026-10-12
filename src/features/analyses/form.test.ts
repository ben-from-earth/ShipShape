import { describe, expect, it } from "vitest";

import {
  MAX_ANALYSIS_LOAD_CASE_LENGTH,
  MAX_ANALYSIS_MARGIN,
  MAX_ANALYSIS_TITLE_LENGTH,
} from "./view";
import { analysisFormErrors, toAnalysisFields } from "./form";

const draft = {
  title: "  Check the joint  ",
  method: " Hand calculation ",
  loadCase: " Limit load ",
  margin: " 0.18 ",
  status: "in_review",
  revision: " A ",
};

describe("analysisFormErrors", () => {
  it("accepts a title and margin and omits blank optionals", () => {
    expect(
      analysisFormErrors({
        title: "Check the joint",
        method: " ",
        loadCase: "",
        margin: "0",
        status: "",
        revision: "",
      }),
    ).toEqual({});
    expect(
      toAnalysisFields({
        title: "  Check the joint  ",
        method: " ",
        loadCase: "",
        margin: "0",
        status: "",
        revision: "",
      }),
    ).toEqual({ title: "Check the joint", margin: 0 });
  });

  it("keeps method, load case, status, and revision when they are set", () => {
    expect(toAnalysisFields(draft)).toEqual({
      title: "Check the joint",
      method: "Hand calculation",
      loadCase: "Limit load",
      margin: 0.18,
      status: "in_review",
      revision: "A",
    });
  });

  it("requires a title and a margin", () => {
    expect(
      analysisFormErrors({
        title: " ",
        method: "",
        loadCase: "",
        margin: "",
        status: "",
        revision: "",
      }),
    ).toEqual({
      title: "A title is required.",
      margin: "A margin is required.",
    });
    expect(
      analysisFormErrors({
        title: "Check the joint",
        method: "",
        loadCase: "",
        margin: "low",
        status: "published",
        revision: "",
      }),
    ).toEqual({
      margin: "Enter a margin.",
      status: "Choose a status.",
    });
  });

  it("rejects a title, load case, or margin outside the limits", () => {
    expect(
      analysisFormErrors({
        title: "a".repeat(MAX_ANALYSIS_TITLE_LENGTH + 1),
        method: "",
        loadCase: "b".repeat(MAX_ANALYSIS_LOAD_CASE_LENGTH + 1),
        margin: String(MAX_ANALYSIS_MARGIN + 1),
        status: "",
        revision: "",
      }),
    ).toEqual({
      title: "Title is too long.",
      loadCase: "Load case is too long.",
      margin: "Margin is out of range.",
    });
  });
});

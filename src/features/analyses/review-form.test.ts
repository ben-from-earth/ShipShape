import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  reviewFormErrors,
  showReviewForm,
  showSubmitForReview,
  toReviewFields,
} from "./review-form";

const empty = { decision: "", comment: "" };

describe("reviewFormErrors", () => {
  it("requires a decision and a comment and sends only those fields", () => {
    expect(reviewFormErrors(empty)).toEqual({
      decision: "Choose a decision.",
      comment: "A comment is required.",
    });
    const fields = toReviewFields({
      decision: "approved",
      comment: "  Margin holds.  ",
    });
    expect(fields).toEqual({
      decision: "approved",
      comment: "Margin holds.",
    });
    expect(Object.keys(fields).sort()).toEqual(["comment", "decision"]);
  });

  it("rejects a decision outside the two radios", () => {
    expect(reviewFormErrors({ decision: "rejected", comment: "No." })).toEqual({
      decision: "Choose a decision.",
    });
  });
});

describe("review panel actions", () => {
  it("offers submit before review and the form only while in review", () => {
    expect(showSubmitForReview("draft")).toBe(true);
    expect(showSubmitForReview("in_progress")).toBe(true);
    expect(showSubmitForReview("changes_requested")).toBe(true);
    expect(showSubmitForReview("in_review")).toBe(false);
    expect(showSubmitForReview("approved")).toBe(false);
    expect(showReviewForm("in_review")).toBe(true);
    expect(showReviewForm("draft")).toBe(false);
  });
});

describe("review contract stand-in", () => {
  it("marks the schemas to import from @/schemas once reviews.ts lands", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "review-contract.ts"),
      "utf8",
    );
    expect(source).toContain(
      'import { reviewDecisionSchema, reviewCreateBodySchema, createReviewResultSchema, submitForReviewResultSchema } from "@/schemas"',
    );
    expect(source).toContain("src/schemas/reviews.ts");
    expect(source).not.toContain("export const analysisCreateBodySchema");
  });
});

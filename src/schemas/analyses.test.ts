import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createAnalysisFieldsSchema,
  createAnalysisResultSchema,
} from "@/schemas";

const repairId = "550e8400-e29b-41d4-a716-446655440061";
const analysisId = "550e8400-e29b-41d4-a716-446655440071";
const revisionId = "550e8400-e29b-41d4-a716-446655440081";
const createdAt = "2026-10-12T22:00:00.000Z";

const analysis = {
  id: analysisId,
  code: "AN-1002",
  repairId,
  revisionId,
  revision: "A",
  title: "Check the joint",
  method: null,
  loadCase: "Primary",
  margin: 0.125,
  status: "draft" as const,
  createdBy: null,
  dueDate: null,
  createdAt,
  updatedAt: createdAt,
};

describe("createAnalysis schemas", () => {
  it("accepts the createAnalysis payload and the stored row", () => {
    expect(
      createAnalysisFieldsSchema.parse({
        repairId,
        title: "  Check the joint  ",
        margin: 0.125,
      }),
    ).toEqual({
      repairId,
      title: "Check the joint",
      margin: 0.125,
    });
    expect(
      createAnalysisFieldsSchema.parse({
        repairId,
        title: "Check the joint",
        method: null,
        loadCase: "Primary",
        margin: -1.5,
        status: "in_review",
        dueDate: null,
        revision: "B",
      }),
    ).toEqual({
      repairId,
      title: "Check the joint",
      method: null,
      loadCase: "Primary",
      margin: -1.5,
      status: "in_review",
      dueDate: null,
      revision: "B",
    });
    expect(
      createAnalysisFieldsSchema.safeParse({
        repairId,
        title: "Check the joint",
        margin: 0.1,
        stressSummary: "no",
        analyst: "ada",
      }).success,
    ).toBe(false);
    expect(createAnalysisResultSchema.parse(analysis)).toEqual(analysis);
    expect(
      createAnalysisResultSchema.safeParse({ ...analysis, loadCase: null })
        .success,
    ).toBe(true);
  });
});

describe("analyses schema module", () => {
  it("stays free of server imports", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/schemas/analyses.ts"),
      "utf8",
    );

    expect(source).not.toContain("server-only");
    expect(source).not.toContain("@/db");
    expect(source).not.toContain("@/server");
  });
});

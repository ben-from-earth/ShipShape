import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  analysisCreateBodySchema,
  analysisCreateSchema,
  analysisSchema,
  createAnalysisResultSchema,
} from "@/schemas";

const repairId = "550e8400-e29b-41d4-a716-446655440041";
const analysisId = "550e8400-e29b-41d4-a716-446655440051";
const revisionId = "550e8400-e29b-41d4-a716-446655440042";
const createdAt = "2026-10-12T21:04:00.000Z";

const record = {
  id: analysisId,
  code: "AN-1002",
  repairId,
  revisionId,
  revision: "A",
  title: "Limit check",
  method: "hand calc",
  loadCase: "Primary",
  margin: 0.05,
  status: "draft" as const,
  createdBy: null,
  dueDate: null,
  createdAt,
  updatedAt: createdAt,
};

describe("analyses schemas", () => {
  it("accepts the create payload and the stored record", () => {
    expect(
      analysisCreateSchema.parse({
        repairId,
        title: "  Limit check  ",
        margin: 0.05,
      }),
    ).toEqual({
      repairId,
      title: "Limit check",
      margin: 0.05,
    });
    expect(
      analysisCreateSchema.safeParse({
        repairId,
        title: "Limit check",
        margin: 0.05,
        orgId: "550e8400-e29b-41d4-a716-446655440001",
        actorId: null,
      }).success,
    ).toBe(false);
    expect(analysisSchema.parse(record)).toEqual(record);
    expect(createAnalysisResultSchema).toBe(analysisSchema);
  });

  it("accepts a create body without repairId", () => {
    expect(
      analysisCreateBodySchema.parse({
        title: "  Limit check  ",
        margin: 0.05,
      }),
    ).toEqual({
      title: "Limit check",
      margin: 0.05,
    });
    expect(
      analysisCreateBodySchema.safeParse({
        title: "Limit check",
        margin: 0.05,
        repairId,
      }).success,
    ).toBe(false);
  });

  it("lives only in the client-safe analyses module", () => {
    const file = path.join(process.cwd(), "src/schemas/analyses.ts");
    const source = readFileSync(file, "utf8");

    expect(source).not.toContain("server-only");
    expect(source).not.toContain("@/db");
    expect(source).not.toContain("@/server");
    expect(
      existsSync(path.join(process.cwd(), "src/schemas/analysis.ts")),
    ).toBe(false);
  });
});

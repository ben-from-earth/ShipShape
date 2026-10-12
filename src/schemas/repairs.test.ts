import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createRepairFieldsSchema,
  createRepairResultSchema,
  repairSchema,
} from "@/schemas";

const findingId = "550e8400-e29b-41d4-a716-446655440031";
const assetId = "550e8400-e29b-41d4-a716-446655440022";
const repairId = "550e8400-e29b-41d4-a716-446655440051";
const createdAt = "2026-10-12T21:04:00.000Z";

const repair = {
  id: repairId,
  code: "REP-1002",
  findingId,
  title: "Replace the seal",
  type: "weld",
  status: "open" as const,
  createdBy: null,
  createdAt,
  updatedAt: createdAt,
  finding: { id: findingId, code: "FND-1002" },
  asset: { id: assetId, identifier: "A-0022", name: "Fitting" },
};

describe("createRepair schemas", () => {
  it("accepts title, optional type and status, and the 201 body", () => {
    expect(
      createRepairFieldsSchema.parse({ title: "  Replace the seal  " }),
    ).toEqual({ title: "Replace the seal" });
    expect(
      createRepairFieldsSchema.parse({
        title: "Replace the seal",
        type: null,
        status: "in_review",
      }),
    ).toEqual({
      title: "Replace the seal",
      type: null,
      status: "in_review",
    });
    expect(createRepairFieldsSchema.safeParse({}).success).toBe(false);
    expect(
      createRepairFieldsSchema.safeParse({
        title: "Replace the seal",
        status: "published",
      }).success,
    ).toBe(false);
    expect(
      createRepairFieldsSchema.safeParse({
        title: "Replace the seal",
        findingId,
        actorId: "550e8400-e29b-41d4-a716-446655440011",
      }).success,
    ).toBe(false);
    expect(createRepairResultSchema.parse(repair)).toEqual(repair);
    expect(
      createRepairResultSchema.parse({
        ...repair,
        asset: { ...repair.asset, name: null },
      }).asset.name,
    ).toBeNull();
    expect(createRepairResultSchema).toBe(repairSchema);
  });
});

describe("repairs schema module", () => {
  it("stays free of server imports", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/schemas/repairs.ts"),
      "utf8",
    );

    expect(source).not.toContain("server-only");
    expect(source).not.toContain("@/db");
    expect(source).not.toContain("@/server");
  });
});

import { randomBytes } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { analysisStatusSchema, engineerRoleSchema } from "@/schemas";

import { ENGINEER_ROLES, ENGINEERING_ANALYSIS_STATUSES } from "./schema";
import { decryptDatabaseUrl, encryptDatabaseUrl } from "./tenant-secret";

const original = process.env.TENANT_SECRET_KEY;

afterEach(() => {
  if (original === undefined) {
    delete process.env.TENANT_SECRET_KEY;
  } else {
    process.env.TENANT_SECRET_KEY = original;
  }
});

describe("tenant database URL encryption", () => {
  it("round-trips a connection string and rejects a tampered payload", () => {
    process.env.TENANT_SECRET_KEY = randomBytes(32).toString("base64");
    const url = "postgresql://ship:secret@db.internal:5432/tenant";
    const first = encryptDatabaseUrl(url);
    const second = encryptDatabaseUrl(url);

    expect(first).not.toBe(second);
    expect(first).not.toContain("secret");
    expect(decryptDatabaseUrl(first)).toBe(url);
    expect(decryptDatabaseUrl(second)).toBe(url);

    const [iv, tag, data] = first.split(".");
    const bytes = Buffer.from(data ?? "", "base64");
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;
    expect(() =>
      decryptDatabaseUrl(`${iv}.${tag}.${bytes.toString("base64")}`),
    ).toThrow();
  });

  it("uses the same role and status lists as the analyses contract", () => {
    expect([...ENGINEER_ROLES]).toEqual([...engineerRoleSchema.options]);
    expect([...ENGINEERING_ANALYSIS_STATUSES]).toEqual([
      ...analysisStatusSchema.options,
    ]);
  });
});

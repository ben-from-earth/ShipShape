import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the password that was hashed and rejects another", async () => {
    const stored = await hashPassword("dev-password");

    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("dev-password", stored)).toBe(true);
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
    expect(await verifyPassword("dev-password", "not-a-hash")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { isLoopbackDatabaseUrl } from "./integration";

describe("isLoopbackDatabaseUrl", () => {
  it("accepts localhost, IPv4 loopback, and bracketed IPv6 loopback", () => {
    expect(isLoopbackDatabaseUrl("postgresql://localhost/shipshape")).toBe(
      true,
    );
    expect(isLoopbackDatabaseUrl("postgresql://127.0.0.1:5432/shipshape")).toBe(
      true,
    );
    expect(isLoopbackDatabaseUrl("postgres://[::1]/shipshape")).toBe(true);
    expect(isLoopbackDatabaseUrl("postgres://[::1]:5432/shipshape")).toBe(true);
  });

  it("rejects any other host", () => {
    expect(isLoopbackDatabaseUrl("postgresql://db.example.com/shipshape")).toBe(
      false,
    );
    expect(isLoopbackDatabaseUrl("not a url")).toBe(false);
  });
});

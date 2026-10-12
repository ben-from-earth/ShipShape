import { afterEach, describe, expect, it, vi } from "vitest";

import { isDemoData } from "./demo";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isDemoData", () => {
  it("stays off unless a flag is exactly true", () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE;
    delete process.env.NEXT_PUBLIC_DOCS_DEMO_MODE;
    expect(isDemoData()).toBe(false);

    for (const value of ["", "false", "1", "TRUE", "true "]) {
      vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", value);
      vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "");
      expect(isDemoData()).toBe(false);
    }

    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    expect(isDemoData()).toBe(true);

    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_DOCS_DEMO_MODE", "true");
    expect(isDemoData()).toBe(true);
  });
});

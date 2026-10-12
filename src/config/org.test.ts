import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_ORGANIZATION_ID, documentOrgId } from "./org";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("documentOrgId", () => {
  it("uses the demo-seed organization unless the env var is set", () => {
    delete process.env.NEXT_PUBLIC_ORG_ID;
    expect(documentOrgId()).toBe(DEMO_ORGANIZATION_ID);
    expect(DEMO_ORGANIZATION_ID).toBe("10000000-0000-4000-8000-000000000001");

    vi.stubEnv("NEXT_PUBLIC_ORG_ID", "  ");
    expect(documentOrgId()).toBe(DEMO_ORGANIZATION_ID);

    vi.stubEnv("NEXT_PUBLIC_ORG_ID", "550e8400-e29b-41d4-a716-446655440000");
    expect(documentOrgId()).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});

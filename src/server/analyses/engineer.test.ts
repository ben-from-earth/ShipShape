import { describe, expect, it, vi } from "vitest";

import { apiErrorSchema } from "@/schemas";

import { readRequestEngineer } from "./engineer";
import { analysisErrorResponse } from "./errors";

const engineerId = "550e8400-e29b-41d4-a716-446655440011";
const createdAt = "2026-10-13T12:00:00.000Z";

const engineer = {
  id: engineerId,
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "reviewer" as const,
  createdAt,
};

function request(engineerId?: string | null) {
  const headers = new Headers();
  if (engineerId !== null) {
    headers.set("x-engineer-id", engineerId ?? engineer.id);
  }
  return new Request("http://localhost/api/analyses", { headers });
}

describe("readRequestEngineer", () => {
  it("loads the engineer named by x-engineer-id", async () => {
    const execute = vi.fn(async () => [engineer]);
    await expect(
      readRequestEngineer(request(), { execute } as never),
    ).resolves.toEqual(engineer);
  });

  it("returns 401 when the header is missing or the engineer is unknown", async () => {
    const execute = vi.fn(async () => []);
    const missing = analysisErrorResponse(
      await readRequestEngineer(request(null), { execute } as never).catch(
        (error: unknown) => error,
      ),
    );
    const unknown = analysisErrorResponse(
      await readRequestEngineer(request(), { execute } as never).catch(
        (error: unknown) => error,
      ),
    );

    expect(missing.status).toBe(401);
    expect(apiErrorSchema.parse(await missing.json()).error.code).toBe(
      "unauthenticated",
    );
    expect(unknown.status).toBe(401);
    expect(apiErrorSchema.parse(await unknown.json()).error.code).toBe(
      "unauthenticated",
    );
    expect(execute).toHaveBeenCalledOnce();
  });

  it("loads the engineer from the session cookie", async () => {
    const execute = vi.fn(async () => [engineer]);
    const requestWithCookie = new Request("http://localhost/api/analyses", {
      headers: { cookie: "engineer_session=raw-token" },
    });

    await expect(
      readRequestEngineer(requestWithCookie, { execute } as never),
    ).resolves.toEqual(engineer);
  });

  it("ignores x-engineer-id in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const execute = vi.fn();
      const response = analysisErrorResponse(
        await readRequestEngineer(request(), { execute } as never).catch(
          (error: unknown) => error,
        ),
      );

      expect(response.status).toBe(401);
      expect(execute).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

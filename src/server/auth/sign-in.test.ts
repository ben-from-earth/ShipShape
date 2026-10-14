import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiErrorSchema } from "@/schemas";
import { analysisErrorResponse } from "@/server/analyses/errors";

import { hashSessionToken, SESSION_DAYS } from "./cookie";
import { hashPassword } from "./password";
import { INVALID_CREDENTIALS_MESSAGE, signInEngineer } from "./sign-in";
import { findEngineerCredentials, insertSession } from "./store";

vi.mock("./store", () => ({
  findEngineerCredentials: vi.fn(),
  insertSession: vi.fn(),
}));

const engineer = {
  id: "550e8400-e29b-41d4-a716-446655440011",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "analyst" as const,
  createdAt: "2026-10-13T12:00:00.000Z",
};

const find = vi.mocked(findEngineerCredentials);
const insert = vi.mocked(insertSession);

beforeEach(() => {
  find.mockReset();
  insert.mockReset();
});

describe("signInEngineer", () => {
  it("stores a hashed token that expires in 30 days", async () => {
    const passwordHash = await hashPassword("dev-password");
    find.mockResolvedValue({ engineer, passwordHash });
    const before = Date.now();

    const session = await signInEngineer({} as never, {
      email: "ada@example.com",
      password: "dev-password",
    });

    expect(session.engineer).toEqual(engineer);
    expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + SESSION_DAYS * 24 * 60 * 60 * 1000 - 1000,
    );
    expect(insert).toHaveBeenCalledWith(
      {},
      {
        engineerId: engineer.id,
        tokenHash: hashSessionToken(session.token),
        expiresAt: session.expiresAt,
      },
    );
  });

  it("returns the same 401 for an unknown email and a wrong password", async () => {
    find.mockResolvedValueOnce(null);
    const unknown = await signInEngineer({} as never, {
      email: "missing@example.com",
      password: "dev-password",
    }).catch((error: unknown) => error);

    const passwordHash = await hashPassword("dev-password");
    find.mockResolvedValueOnce({ engineer, passwordHash });
    const wrong = await signInEngineer({} as never, {
      email: engineer.email,
      password: "nope",
    }).catch((error: unknown) => error);

    for (const error of [unknown, wrong]) {
      const response = analysisErrorResponse(error);
      expect(response.status).toBe(401);
      expect(apiErrorSchema.parse(await response.json()).error).toEqual({
        code: "unauthenticated",
        message: INVALID_CREDENTIALS_MESSAGE,
      });
    }
    expect(insert).not.toHaveBeenCalled();
  });
});

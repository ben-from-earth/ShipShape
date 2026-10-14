import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTenantDb } from "@/db/tenant-db";
import { apiErrorSchema, engineerSchema } from "@/schemas";
import { AnalysisRequestError } from "@/server/analyses/errors";
import { SESSION_COOKIE } from "@/server/auth/cookie";
import {
  INVALID_CREDENTIALS_MESSAGE,
  signInEngineer,
} from "@/server/auth/sign-in";
import { deleteSession } from "@/server/auth/store";

import { GET as me } from "../me/route";
import { POST as signOut } from "../sign-out/route";
import { POST as signIn } from "./route";

vi.mock("@/db/tenant-db", () => ({
  getTenantDb: vi.fn(),
}));

vi.mock("@/server/auth/sign-in", () => ({
  signInEngineer: vi.fn(),
  INVALID_CREDENTIALS_MESSAGE: "Email or password is incorrect.",
}));

vi.mock("@/server/auth/store", () => ({
  deleteSession: vi.fn(),
  findEngineerBySessionToken: vi.fn(),
}));

const orgId = "550e8400-e29b-41d4-a716-446655440000";
const engineerId = "550e8400-e29b-41d4-a716-446655440011";
const execute = vi.fn();
const tenantDb = vi.mocked(getTenantDb);
const signInEngineerMock = vi.mocked(signInEngineer);
const deleteSessionMock = vi.mocked(deleteSession);

const engineer = {
  id: engineerId,
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "analyst" as const,
  createdAt: "2026-10-13T12:00:00.000Z",
};

beforeEach(() => {
  execute.mockReset();
  execute.mockResolvedValue([engineer]);
  tenantDb.mockReset();
  tenantDb.mockResolvedValue({ execute } as never);
  signInEngineerMock.mockReset();
  deleteSessionMock.mockReset();
});

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/sign-in", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-org-id": orgId,
    },
    body: JSON.stringify(body),
  });
}

describe("auth routes", () => {
  it("sets an httpOnly Secure session cookie", async () => {
    const expiresAt = new Date("2026-11-13T00:00:00.000Z");
    signInEngineerMock.mockResolvedValue({
      engineer,
      token: "raw-token",
      expiresAt,
    });

    const response = await signIn(
      jsonRequest({ email: "ada@example.com", password: "dev-password" }),
    );

    expect(response.status).toBe(200);
    expect(engineerSchema.parse(await response.json())).toEqual(engineer);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=raw-token`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(tenantDb).toHaveBeenCalledWith(orgId);
  });

  it("returns a generic 401 and rejects an unknown key", async () => {
    signInEngineerMock.mockRejectedValue(
      new AnalysisRequestError("unauthenticated", INVALID_CREDENTIALS_MESSAGE),
    );
    const badPassword = await signIn(
      jsonRequest({ email: "ada@example.com", password: "nope" }),
    );
    const unknown = await signIn(
      jsonRequest({
        email: "ada@example.com",
        password: "dev-password",
        role: "approver",
      }),
    );

    expect(badPassword.status).toBe(401);
    expect(apiErrorSchema.parse(await badPassword.json()).error).toEqual({
      code: "unauthenticated",
      message: INVALID_CREDENTIALS_MESSAGE,
    });
    expect(unknown.status).toBe(400);
    expect(apiErrorSchema.parse(await unknown.json()).error).toMatchObject({
      code: "validation_error",
      details: [{ path: "body" }],
    });
    expect(signInEngineerMock).toHaveBeenCalledTimes(1);
  });

  it("clears the session cookie on sign-out", async () => {
    const response = await signOut(
      new Request("http://localhost/api/auth/sign-out", {
        method: "POST",
        headers: { "x-org-id": orgId, cookie: `${SESSION_COOKIE}=raw-token` },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(deleteSessionMock).toHaveBeenCalledOnce();
  });

  it("returns the engineer from the dev header", async () => {
    const response = await me(
      new Request("http://localhost/api/auth/me", {
        headers: { "x-org-id": orgId, "x-engineer-id": engineerId },
      }),
    );

    expect(response.status).toBe(200);
    expect(engineerSchema.parse(await response.json())).toEqual(engineer);
  });
});

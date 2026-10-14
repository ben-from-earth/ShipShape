import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_ORGANIZATION_ID, ORG_ID_HEADER } from "@/config/org";

import { AuthApiError, fetchCurrentEngineer, signIn, signOut } from "./client";

const engineer = {
  id: "10000000-0000-4000-8000-000000000072",
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "analyst" as const,
  createdAt: "2026-10-13T12:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth client", () => {
  it("posts sign-in with x-org-id and the schema fields", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(engineer));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      signIn({ email: " ada@example.com ", password: "dev-password" }),
    ).resolves.toEqual(engineer);

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/sign-in", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        [ORG_ID_HEADER]: DEMO_ORGANIZATION_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "ada@example.com",
        password: "dev-password",
      }),
    });
  });

  it("surfaces the 401 message inline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: "unauthenticated",
              message: "Email or password is incorrect.",
            },
          },
          401,
        ),
      ),
    );

    await expect(
      signIn({ email: "ada@example.com", password: "wrong" }),
    ).rejects.toEqual(
      expect.objectContaining({
        status: 401,
        message: "Email or password is incorrect.",
      }),
    );
  });

  it("reads the current engineer and signs out with x-org-id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(engineer))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCurrentEngineer()).resolves.toEqual(engineer);
    await expect(signOut()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/auth/me", {
      method: "GET",
      credentials: "same-origin",
      headers: { [ORG_ID_HEADER]: DEMO_ORGANIZATION_ID },
      body: undefined,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/auth/sign-out", {
      method: "POST",
      credentials: "same-origin",
      headers: { [ORG_ID_HEADER]: DEMO_ORGANIZATION_ID },
      body: undefined,
    });
  });

  it("rejects a sign-in body the schema would refuse", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      signIn({ email: "not-an-email", password: "" }),
    ).rejects.toBeInstanceOf(AuthApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

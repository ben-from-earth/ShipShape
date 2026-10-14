import { describe, expect, it } from "vitest";

import { authRedirectTarget, safeReturnPath, signInPath } from "./return-path";

describe("safeReturnPath", () => {
  it("keeps an in-app path and falls back otherwise", () => {
    expect(safeReturnPath("/dashboard")).toBe("/dashboard");
    expect(safeReturnPath("/analyses?status=in_review")).toBe(
      "/analyses?status=in_review",
    );
    expect(safeReturnPath(null)).toBe("/analyses");
    expect(safeReturnPath("https://evil.example/analyses")).toBe("/analyses");
    expect(safeReturnPath("//evil.example")).toBe("/analyses");
    expect(safeReturnPath("/sign-in")).toBe("/analyses");
    expect(safeReturnPath("/sign-in?next=/dashboard")).toBe("/analyses");
    expect(safeReturnPath("/analyses/../../etc")).toBe("/analyses");
  });
});

describe("authRedirectTarget", () => {
  it("sends an anonymous app request to sign-in", () => {
    expect(
      authRedirectTarget({
        pathname: "/repairs",
        search: "",
        hasSession: false,
        demo: false,
      }),
    ).toBe(signInPath("/repairs"));
  });

  it("leaves demo mode, a session, sign-in, and the API alone", () => {
    const base = {
      pathname: "/analyses",
      search: "",
      hasSession: false,
      demo: true,
    };
    expect(authRedirectTarget(base)).toBeNull();
    expect(
      authRedirectTarget({ ...base, demo: false, hasSession: true }),
    ).toBeNull();
    expect(
      authRedirectTarget({
        ...base,
        demo: false,
        pathname: "/sign-in",
      }),
    ).toBeNull();
    expect(
      authRedirectTarget({
        ...base,
        demo: false,
        pathname: "/api/auth/me",
      }),
    ).toBeNull();
  });
});

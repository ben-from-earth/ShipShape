import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { SignInForm } from "./sign-in-form";

describe("sign-in form", () => {
  it("asks for email and password", () => {
    const html = renderToStaticMarkup(<SignInForm next="/dashboard" />);

    expect(html).toContain("Sign in");
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain("Email");
    expect(html).toContain("Password");
  });
});

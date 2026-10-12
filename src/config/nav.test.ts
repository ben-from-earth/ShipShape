import { describe, expect, it } from "vitest";

import { APP_NAV, crumbsForPath, isNavActive } from "@/config/nav";

const aircraftTerms = /\b(fleet|buno|fuselage|\bfs\b)\b/i;

describe("crumbsForPath", () => {
  it("reads Asset group / Asset on the dashboard", () => {
    expect(crumbsForPath("/dashboard").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      "Asset",
    ]);
  });

  it("appends the section on the other app routes", () => {
    expect(crumbsForPath("/engineering").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      "Asset",
      "Engineering",
    ]);
    expect(crumbsForPath("/docs/search").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      "Asset",
      "Docs",
    ]);
    expect(
      crumbsForPath("/tools/layer-loads").map((crumb) => crumb.label),
    ).toEqual(["Asset group", "Asset", "Tools"]);
  });

  it("does not hard-code aircraft terms", () => {
    const labels = [
      ...APP_NAV.map((item) => item.label),
      ...["/dashboard", "/engineering", "/docs", "/tools"].flatMap((path) =>
        crumbsForPath(path).map((crumb) => crumb.label),
      ),
    ];

    for (const label of labels) {
      expect(label).not.toMatch(aircraftTerms);
    }
  });
});

describe("isNavActive", () => {
  it("matches the section and its nested routes", () => {
    expect(isNavActive("/engineering", "/engineering")).toBe(true);
    expect(isNavActive("/engineering/analyses", "/engineering")).toBe(true);
    expect(isNavActive("/docs", "/engineering")).toBe(false);
    expect(isNavActive("/dashboard", "/docs")).toBe(false);
  });
});

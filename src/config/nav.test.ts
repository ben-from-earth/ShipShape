import { describe, expect, it } from "vitest";

import { DEMO_ASSET_GROUP_NAME } from "@/config/demo";
import { APP_NAV, crumbsForPath, isNavActive } from "@/config/nav";

const aircraftTerms = /\b(fleet|buno|fuselage|\bfs\b)\b/i;

describe("crumbsForPath", () => {
  it("reads Asset group and the demo group name on the dashboard", () => {
    expect(crumbsForPath("/dashboard").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      DEMO_ASSET_GROUP_NAME,
    ]);
  });

  it("appends the section on the other app routes", () => {
    expect(crumbsForPath("/engineering").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      DEMO_ASSET_GROUP_NAME,
      "Engineering",
    ]);
    expect(crumbsForPath("/docs/search").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      DEMO_ASSET_GROUP_NAME,
      "Docs",
    ]);
    expect(
      crumbsForPath("/tools/layer-loads").map((crumb) => crumb.label),
    ).toEqual(["Asset group", DEMO_ASSET_GROUP_NAME, "Tools"]);
    expect(crumbsForPath("/findings/new").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      DEMO_ASSET_GROUP_NAME,
      "New finding",
    ]);
  });

  it("does not hard-code aircraft terms", () => {
    const labels = [
      ...APP_NAV.map((item) => item.label),
      ...[
        "/dashboard",
        "/engineering",
        "/docs",
        "/tools",
        "/findings/new",
      ].flatMap((path) => crumbsForPath(path).map((crumb) => crumb.label)),
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

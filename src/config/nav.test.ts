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
    expect(crumbsForPath("/findings").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      DEMO_ASSET_GROUP_NAME,
      "Findings",
    ]);
    expect(crumbsForPath("/findings/new").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      DEMO_ASSET_GROUP_NAME,
      "Findings",
      "New finding",
    ]);
    expect(
      crumbsForPath("/findings/10000000-0000-4000-8000-000000000031").map(
        (crumb) => crumb.label,
      ),
    ).toEqual(["Asset group", DEMO_ASSET_GROUP_NAME, "Findings", "Finding"]);
    expect(crumbsForPath("/repairs").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      DEMO_ASSET_GROUP_NAME,
      "Repairs",
    ]);
    expect(
      crumbsForPath("/repairs/10000000-0000-4000-8000-000000000041").map(
        (crumb) => crumb.label,
      ),
    ).toEqual(["Asset group", DEMO_ASSET_GROUP_NAME, "Repairs", "Repair"]);
    expect(crumbsForPath("/analyses").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      DEMO_ASSET_GROUP_NAME,
      "Analyses",
    ]);
    expect(
      crumbsForPath("/analyses/10000000-0000-4000-8000-000000000051").map(
        (crumb) => crumb.label,
      ),
    ).toEqual(["Asset group", DEMO_ASSET_GROUP_NAME, "Analyses", "Analysis"]);
  });

  it("does not hard-code aircraft terms", () => {
    const labels = [
      ...APP_NAV.map((item) => item.label),
      ...[
        "/dashboard",
        "/engineering",
        "/docs",
        "/tools",
        "/findings",
        "/findings/new",
        "/findings/10000000-0000-4000-8000-000000000031",
        "/repairs",
        "/repairs/10000000-0000-4000-8000-000000000041",
        "/analyses/10000000-0000-4000-8000-000000000051",
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
    expect(isNavActive("/findings", "/findings")).toBe(true);
    expect(isNavActive("/findings/new", "/findings")).toBe(true);
    expect(isNavActive("/repairs", "/repairs")).toBe(true);
    expect(
      isNavActive("/repairs/10000000-0000-4000-8000-000000000041", "/repairs"),
    ).toBe(true);
    expect(
      isNavActive(
        "/analyses/10000000-0000-4000-8000-000000000051",
        "/analyses",
      ),
    ).toBe(true);
    expect(
      isNavActive(
        "/analyses/10000000-0000-4000-8000-000000000051",
        "/engineering",
      ),
    ).toBe(false);
    expect(
      isNavActive(
        "/analyses/10000000-0000-4000-8000-000000000051",
        "/findings",
      ),
    ).toBe(false);
    expect(isNavActive("/repairs", "/findings")).toBe(false);
    expect(
      isNavActive(
        "/findings/10000000-0000-4000-8000-000000000031",
        "/findings",
      ),
    ).toBe(true);
  });
});

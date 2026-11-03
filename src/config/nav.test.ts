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
      "Analyses",
    ]);
    expect(crumbsForPath("/docs/search").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      DEMO_ASSET_GROUP_NAME,
      "Docs",
    ]);
    expect(
      crumbsForPath("/tools/layer-loads").map((crumb) => crumb.label),
    ).toEqual(["Asset group", DEMO_ASSET_GROUP_NAME, "Tools"]);
    expect(crumbsForPath("/issues").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      DEMO_ASSET_GROUP_NAME,
      "Issues",
    ]);
    expect(crumbsForPath("/issues/new").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      DEMO_ASSET_GROUP_NAME,
      "Issues",
      "New issue",
    ]);
    expect(
      crumbsForPath("/issues/10000000-0000-4000-8000-000000000031").map(
        (crumb) => crumb.label,
      ),
    ).toEqual(["Asset group", DEMO_ASSET_GROUP_NAME, "Issues", "Issue"]);
    expect(crumbsForPath("/findings").map((crumb) => crumb.label)).toEqual([
      "Asset group",
      DEMO_ASSET_GROUP_NAME,
      "Issues",
    ]);
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
        "/issues",
        "/issues/new",
        "/issues/10000000-0000-4000-8000-000000000031",
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
    expect(isNavActive("/analyses", "/analyses")).toBe(true);
    expect(isNavActive("/engineering", "/analyses")).toBe(true);
    expect(isNavActive("/docs", "/analyses")).toBe(false);
    expect(isNavActive("/dashboard", "/docs")).toBe(false);
    expect(isNavActive("/issues", "/issues")).toBe(true);
    expect(isNavActive("/issues/new", "/issues")).toBe(true);
    expect(isNavActive("/findings/new", "/issues")).toBe(true);
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
      isNavActive("/analyses/10000000-0000-4000-8000-000000000051", "/issues"),
    ).toBe(false);
    expect(isNavActive("/repairs", "/issues")).toBe(false);
    expect(
      isNavActive("/issues/10000000-0000-4000-8000-000000000031", "/issues"),
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { getDashboard as getDbDashboard } from "./data";
import { getDashboard as getDatabaseDashboard } from "./db";
import { getDashboard, getDashboards } from "./demo";

describe("dashboard readers", () => {
  it("returns promises the page can await", async () => {
    const dashboards = getDashboards();
    expect(dashboards).toBeInstanceOf(Promise);

    const periods = await dashboards;
    expect(periods["30D"].kpis.length).toBeGreaterThan(0);
    expect(await getDashboard("90D")).toMatchObject({ period: "90D" });
  });

  it("serves the database reader from the page module", () => {
    expect(getDbDashboard).toBe(getDatabaseDashboard);
  });
});

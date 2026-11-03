import "server-only";

import { getDb, type Database } from "@/db";
import { loadOrEmpty } from "@/db/tenant";
import { readRequestClock } from "@/lib/request-day";

import {
  dashboardPeriods,
  getDashboard as getDemoDashboard,
  getDashboards as getDemoDashboards,
} from "./demo";
import { buildDashboardModel } from "./map";
import type { DashboardModel, DashboardPeriod } from "./types";

export { dashboardPeriods };

/**
 * Dashboard for an already-open database. Tests pass a node-postgres
 * client; the page goes through `getDashboard`.
 */
export async function readDashboard(
  db: Pick<Database, "query">,
  period: DashboardPeriod,
  asOf: string,
): Promise<DashboardModel> {
  return buildDashboardModel(await loadOrEmpty(db), period, asOf);
}

/**
 * Live dashboard. With no `DATABASE_URL` this returns the demo model so
 * `npm run dev` and `npm run build` still render. `io()` keeps either path out
 * of the static shell, so a configured database is read per request.
 */
export async function getDashboard(
  period: DashboardPeriod,
): Promise<DashboardModel> {
  const clock = await readRequestClock();

  if (!process.env.DATABASE_URL) {
    return getDemoDashboard(period);
  }

  return readDashboard(getDb(), period, clock.asOf);
}

export async function getDashboards(): Promise<
  Record<DashboardPeriod, DashboardModel>
> {
  const clock = await readRequestClock();

  if (!process.env.DATABASE_URL) {
    return getDemoDashboards();
  }

  const snapshot = await loadOrEmpty(getDb());

  return {
    "30D": buildDashboardModel(snapshot, "30D", clock.asOf),
    "90D": buildDashboardModel(snapshot, "90D", clock.asOf),
    "12M": buildDashboardModel(snapshot, "12M", clock.asOf),
  };
}

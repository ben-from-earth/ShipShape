import "server-only";

import { io } from "next/cache";

import { getDb, type Database } from "@/db";
import { loadOrEmpty } from "@/db/tenant";
import { isoDateUtc } from "@/lib/dates";

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
 * `pnpm dev` and `pnpm build` still render. `io()` keeps either path out
 * of the static shell, so a configured database is read per request.
 */
export async function getDashboard(
  period: DashboardPeriod,
): Promise<DashboardModel> {
  await io();

  if (!process.env.DATABASE_URL) {
    return getDemoDashboard(period);
  }

  return readDashboard(getDb(), period, isoDateUtc(new Date()));
}

export async function getDashboards(): Promise<
  Record<DashboardPeriod, DashboardModel>
> {
  await io();

  if (!process.env.DATABASE_URL) {
    return getDemoDashboards();
  }

  const asOf = isoDateUtc(new Date());
  const snapshot = await loadOrEmpty(getDb());

  return {
    "30D": buildDashboardModel(snapshot, "30D", asOf),
    "90D": buildDashboardModel(snapshot, "90D", asOf),
    "12M": buildDashboardModel(snapshot, "12M", asOf),
  };
}

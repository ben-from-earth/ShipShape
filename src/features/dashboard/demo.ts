import "server-only";

import {
  DEMO_AS_OF,
  DEMO_AS_OF_LABEL,
  DEMO_ASSET_GROUP_NAME,
} from "@/config/demo";

import {
  agingNote,
  buildPipeline,
  countByAge,
  countByZone,
  engineerRows,
  itemsNeedingAttention,
} from "./derive";
import {
  ENGINEERS,
  OPEN_ITEMS,
  PERIOD_KPIS,
  PERIOD_THROUGHPUT,
  STAGE_META,
} from "./fixtures";
import type { DashboardModel, DashboardPeriod } from "./types";

const PERIODS: readonly DashboardPeriod[] = ["30D", "90D", "12M"];

/**
 * Fixture dashboard. The page imports `./data`, which re-exports the
 * database readers. This module stays so tests and a missing
 * `DATABASE_URL` can still render the typed demo.
 */
export async function getDashboard(
  period: DashboardPeriod,
): Promise<DashboardModel> {
  const throughput = PERIOD_THROUGHPUT[period];

  return {
    period,
    asOf: DEMO_AS_OF,
    asOfLabel: DEMO_AS_OF_LABEL,
    assetGroupName: DEMO_ASSET_GROUP_NAME,
    kpis: [...PERIOD_KPIS[period]],
    pipeline: buildPipeline(OPEN_ITEMS, STAGE_META),
    throughputSubtitle: throughput.subtitle,
    throughput: [...throughput.points],
    zones: countByZone(OPEN_ITEMS),
    aging: countByAge(OPEN_ITEMS, DEMO_AS_OF),
    agingNote: agingNote(OPEN_ITEMS, DEMO_AS_OF),
    engineers: engineerRows(ENGINEERS),
    attention: itemsNeedingAttention(OPEN_ITEMS),
  };
}

export async function getDashboards(): Promise<
  Record<DashboardPeriod, DashboardModel>
> {
  const [thirty, ninety, year] = await Promise.all([
    getDashboard("30D"),
    getDashboard("90D"),
    getDashboard("12M"),
  ]);

  return {
    "30D": thirty,
    "90D": ninety,
    "12M": year,
  };
}

export function dashboardPeriods(): readonly DashboardPeriod[] {
  return PERIODS;
}

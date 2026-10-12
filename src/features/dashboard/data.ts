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
 * Dashboard view model. Swap the fixture reads for queries later;
 * keep the `DashboardModel` return type so the page components stay put.
 */
export function getDashboard(period: DashboardPeriod): DashboardModel {
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

export function getDashboards(): Record<DashboardPeriod, DashboardModel> {
  return {
    "30D": getDashboard("30D"),
    "90D": getDashboard("90D"),
    "12M": getDashboard("12M"),
  };
}

export function dashboardPeriods(): readonly DashboardPeriod[] {
  return PERIODS;
}

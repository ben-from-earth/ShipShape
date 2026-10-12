import { shiftIsoDate } from "@/lib/dates";

import type { DashboardPeriod } from "./types";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const DAY_MS = 86_400_000;

export const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  "30D": 30,
  "90D": 90,
  "12M": 365,
};

export const THROUGHPUT_SUBTITLE: Record<DashboardPeriod, string> = {
  "30D": "Weekly, last 12 weeks",
  "90D": "Bi-weekly, last 24 weeks",
  "12M": "Monthly, last 12 months",
};

export type ThroughputBucket = {
  label: string;
  /** Inclusive start, UTC instant. */
  start: string;
  /** Exclusive end, UTC instant. */
  end: string;
};

function utcDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * DAY_MS);
}

function isoWeekStart(isoDate: string): Date {
  const date = utcDay(isoDate);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date;
}

function isoWeekNumber(instant: Date): number {
  const date = new Date(
    Date.UTC(
      instant.getUTCFullYear(),
      instant.getUTCMonth(),
      instant.getUTCDate(),
    ),
  );
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

function monthLetter(monthIndex: number): string {
  return MONTHS[monthIndex]?.[0] ?? "";
}

/**
 * Twelve buckets ending at the current week or month.
 * 30D is calendar weeks, 90D is pairs of weeks, 12M is calendar months.
 */
export function throughputBuckets(
  period: DashboardPeriod,
  asOf: string,
): ThroughputBucket[] {
  if (period === "12M") {
    const asOfDate = utcDay(asOf);
    const endMonth = Date.UTC(
      asOfDate.getUTCFullYear(),
      asOfDate.getUTCMonth() + 1,
      1,
    );

    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(endMonth);
      start.setUTCMonth(start.getUTCMonth() - (12 - index));
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      return {
        label: monthLetter(start.getUTCMonth()),
        start: start.toISOString(),
        end: end.toISOString(),
      };
    });
  }

  const weekStart = isoWeekStart(asOf);
  const horizonEnd = addDays(weekStart, 7);
  const span = period === "30D" ? 7 : 14;
  const buckets: ThroughputBucket[] = [];

  for (let index = 11; index >= 0; index -= 1) {
    const end = addDays(horizonEnd, -index * span);
    const start = addDays(end, -span);
    buckets.push({
      label:
        period === "30D"
          ? `W${isoWeekNumber(start)}`
          : (MONTHS[start.getUTCMonth()] ?? ""),
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }

  if (period === "90D") {
    let previousMonth = -1;
    for (const bucket of buckets) {
      const month = new Date(bucket.start).getUTCMonth();
      if (month === previousMonth) {
        bucket.label = "";
      }
      previousMonth = month;
    }
  }

  return buckets;
}

/** Day the current reporting window opens. That day itself is prior. */
export function periodStart(asOf: string, period: DashboardPeriod): string {
  return shiftIsoDate(asOf, -PERIOD_DAYS[period]);
}

export function inDayWindow(
  instant: string,
  startExclusive: string,
  endInclusive: string,
): boolean {
  const day = instant.slice(0, 10);
  return day > startExclusive && day <= endInclusive;
}

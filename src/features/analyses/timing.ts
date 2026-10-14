/**
 * Due and age math for standalone analyses.
 * Age stays in whole UTC days. Due badges use the viewer's local calendar,
 * so a UTC midnight does not mark a US evening overdue a day early.
 */

export type DueBadge = "overdue" | "due-soon";

const DAY_MS = 86_400_000;

/** Whole UTC days from `start` to `end`. Negative when `end` is earlier. */
export function daysBetween(start: string, end: string): number {
  return Math.round((utcDay(end) - utcDay(start)) / DAY_MS);
}

/** Days from `createdAt` to `asOf`, never negative. */
export function ageDays(createdAt: string, asOf: string): number {
  return Math.max(0, daysBetween(createdAt, asOf));
}

/**
 * Overdue is a past due date on an analysis that is not approved.
 * Due soon is due today through the next 3 days, and not approved.
 */
export function dueBadge(
  dueDate: string | null,
  status: string,
  asOf: string,
  timeZone?: string,
): DueBadge | null {
  if (!dueDate || status === "approved") {
    return null;
  }
  const delta = calendarDaysBetween(asOf, dueDate, timeZone);
  if (delta < 0) {
    return "overdue";
  }
  if (delta <= 3) {
    return "due-soon";
  }
  return null;
}

/** Due today through the next 6 days, and not approved. */
export function isDueThisWeek(
  dueDate: string | null,
  status: string,
  asOf: string,
  timeZone?: string,
): boolean {
  if (!dueDate || status === "approved") {
    return false;
  }
  const delta = calendarDaysBetween(asOf, dueDate, timeZone);
  return delta >= 0 && delta <= 6;
}

/** Mean whole days from creation to approval. Null when none are approved. */
export function averageApprovalDays(
  records: readonly { createdAt: string; approvedAt: string | null }[],
): number | null {
  const samples = records.filter(
    (record): record is { createdAt: string; approvedAt: string } =>
      record.approvedAt != null,
  );
  if (samples.length === 0) {
    return null;
  }
  const total = samples.reduce(
    (sum, record) => sum + daysBetween(record.createdAt, record.approvedAt),
    0,
  );
  return Math.round(total / samples.length);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function utcDay(value: string): number {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/** Calendar days from `start` to `end` in `timeZone`, or the runtime zone. */
function calendarDaysBetween(
  start: string,
  end: string,
  timeZone?: string,
): number {
  return Math.round(
    (utcDay(calendarDay(end, timeZone)) -
      utcDay(calendarDay(start, timeZone))) /
      DAY_MS,
  );
}

/**
 * A `YYYY-MM-DD` value is already a calendar date.
 * A timestamp is the calendar date in the viewer's time zone.
 */
function calendarDay(value: string, timeZone?: string): string {
  if (DATE_ONLY.test(value)) {
    return value;
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    return value.slice(0, 10);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

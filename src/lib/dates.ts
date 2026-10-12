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

function utcMs(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

/** Whole days from `earlier` to `later`. Negative when `later` is first. */
export function daysBetween(earlier: string, later: string): number {
  return Math.round((utcMs(later) - utcMs(earlier)) / DAY_MS);
}

export function shiftIsoDate(isoDate: string, days: number): string {
  return new Date(utcMs(isoDate) + days * DAY_MS).toISOString().slice(0, 10);
}

/** `2026-10-06` → `Oct 6`. */
export function formatShortDate(isoDate: string): string {
  const [, monthRaw, dayRaw] = isoDate.split("-");
  const month = MONTHS[Number(monthRaw) - 1];
  const day = Number(dayRaw);

  if (!month || !Number.isFinite(day)) {
    return isoDate;
  }

  return `${month} ${day}`;
}

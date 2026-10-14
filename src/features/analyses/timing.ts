/** Due and age math for standalone analyses. Dates are UTC calendar days. */

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
): DueBadge | null {
  if (!dueDate || status === "approved") {
    return null;
  }
  const delta = daysBetween(asOf, dueDate);
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
): boolean {
  if (!dueDate || status === "approved") {
    return false;
  }
  const delta = daysBetween(asOf, dueDate);
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

function utcDay(value: string): number {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

import {
  idSchema,
  repairListFiltersSchema,
  repairStatusSchema,
  type RepairListFilters,
  type RepairStatus,
} from "@/schemas";

export type RepairSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  const values = Array.isArray(value) ? value : [value];
  for (const item of values) {
    const text = item?.trim() ?? "";
    if (text.length > 0) {
      return text;
    }
  }
  return "";
}

function statusFrom(value: string): RepairStatus | undefined {
  const parsed = repairStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Keep only filters `listRepairs` will accept.
 * A bad status or finding id is omitted. The call does not throw.
 */
export function repairFiltersFromSearchParams(
  searchParams: RepairSearchParams,
): RepairListFilters {
  const filters: RepairListFilters = {};
  const status = statusFrom(first(searchParams.status));
  const findingId = first(searchParams.findingId);

  if (status) {
    filters.status = status;
  }
  if (idSchema.safeParse(findingId).success) {
    filters.findingId = findingId;
  }

  return repairListFiltersSchema.parse(filters);
}

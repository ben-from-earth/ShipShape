import { SEVERITIES, type Severity } from "@/config/severity";
import {
  findingStageSchema,
  idSchema,
  type FindingListFilters,
  type FindingStage,
} from "@/schemas";

export type FindingSearchParams = Record<string, string | string[] | undefined>;

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

function stageFrom(value: string): FindingStage | undefined {
  const parsed = findingStageSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function severityFrom(value: string): Severity | undefined {
  const match = SEVERITIES.find((severity) => severity === value);
  return match;
}

/**
 * Keep only filters `listFindings` will accept.
 * A bad stage, severity, or asset id is omitted. The call does not throw.
 */
export function findingFiltersFromSearchParams(
  searchParams: FindingSearchParams,
): FindingListFilters {
  const filters: FindingListFilters = {};
  const stage = stageFrom(first(searchParams.stage));
  const severity = severityFrom(first(searchParams.severity));
  const assetId = first(searchParams.assetId);

  if (stage) {
    filters.stage = stage;
  }
  if (severity) {
    filters.severity = severity;
  }
  if (idSchema.safeParse(assetId).success) {
    filters.assetId = assetId;
  }

  return filters;
}

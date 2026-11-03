import "server-only";

import { DEMO_AS_OF } from "@/config/demo";
import {
  repairListFiltersSchema,
  repairSchema,
  type Repair,
  type RepairListFilters,
} from "@/schemas";

/**
 * Fixture repair for an explicit demo session.
 * Ids match `demoRepair` and `demoIssue` in `src/db/demo-seed.ts`.
 * This module is not a stand-in for a missing database.
 */
const DEMO_REPAIR_ID = "10000000-0000-4000-8000-000000000041";
const DEMO_FINDING_ID = "10000000-0000-4000-8000-000000000031";
const DEMO_ASSET_ID = "10000000-0000-4000-8000-000000000022";
const DEMO_CREATED_AT = `${DEMO_AS_OF}T12:00:00.000Z`;

const DEMO_REPAIRS: readonly Repair[] = [
  repairSchema.parse({
    id: DEMO_REPAIR_ID,
    code: "REP-1001",
    findingId: DEMO_FINDING_ID,
    title: "Canopy sill doubler",
    type: "doubler",
    status: "draft",
    createdBy: null,
    createdAt: DEMO_CREATED_AT,
    updatedAt: DEMO_CREATED_AT,
    finding: { id: DEMO_FINDING_ID, code: "ISS-1001" },
    asset: {
      id: DEMO_ASSET_ID,
      identifier: "DEMO-T45-001",
      name: "Demo airframe",
    },
  }),
];

function matches(record: Repair, filters: RepairListFilters): boolean {
  if (
    filters.findingId !== undefined &&
    record.findingId !== filters.findingId
  ) {
    return false;
  }
  if (filters.status !== undefined && record.status !== filters.status) {
    return false;
  }
  return true;
}

function compareRepairs(left: Repair, right: Repair): number {
  const byCreated = right.createdAt.localeCompare(left.createdAt);
  if (byCreated !== 0) {
    return byCreated;
  }
  return right.id.localeCompare(left.id);
}

export async function listDemoRepairs(
  filters?: RepairListFilters,
): Promise<Repair[]> {
  const parsed = repairListFiltersSchema.parse(filters ?? {});
  return DEMO_REPAIRS.filter((record) => matches(record, parsed)).sort(
    compareRepairs,
  );
}

export async function getDemoRepair(id: string): Promise<Repair | null> {
  return DEMO_REPAIRS.find((record) => record.id === id) ?? null;
}

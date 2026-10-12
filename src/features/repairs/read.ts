import "server-only";

import { io } from "next/cache";

import { isDemoData } from "@/config/demo";
import { getDb, type Database } from "@/db";
import { organizations } from "@/db/schema";
import { getFinding } from "@/features/findings/data";
import { oldestOrganizationOrder } from "@/lib/org-threshold";
import { idSchema, type Repair, type RepairListFilters } from "@/schemas";

import { getRepair, listRepairs } from "./data";
import { getDemoRepair, listDemoRepairs } from "./demo";
import type { RepairView } from "./view";

/**
 * Repairs for the page. Demo rows are used only when `isDemoData()` is on.
 * With the flag off and no database, the list is empty and a detail is null.
 * That is not filled in with the fixture.
 */
export async function listRepairViews(
  filters?: RepairListFilters,
): Promise<RepairView[]> {
  await io();

  if (isDemoData()) {
    return listDemoRepairs(filters);
  }
  if (!process.env.DATABASE_URL) {
    return [];
  }

  const db = getDb();
  const orgId = await tenantOrgId(db);
  if (!orgId) {
    return [];
  }

  return attachFindings(await listRepairs(orgId, filters, db));
}

/** Null when the id is not a uuid, the row is missing, or it is another org. */
export async function getRepairView(id: string): Promise<RepairView | null> {
  await io();

  if (!idSchema.safeParse(id).success) {
    return null;
  }
  if (isDemoData()) {
    return getDemoRepair(id);
  }
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const db = getDb();
  const orgId = await tenantOrgId(db);
  if (!orgId) {
    return null;
  }

  const repair = await getRepair(orgId, id, db);
  if (!repair) {
    return null;
  }

  const [view] = await attachFindings([repair]);
  return view ?? null;
}

async function tenantOrgId(
  db: Pick<Database, "select">,
): Promise<string | null> {
  const rows = await db
    .select({ id: organizations.id })
    .from(organizations)
    .orderBy(...oldestOrganizationOrder())
    .limit(1);
  return rows[0]?.id ?? null;
}

async function attachFindings(
  repairs: readonly Repair[],
): Promise<RepairView[]> {
  const findings = new Map<
    string,
    { code: string; identifier: string; name: string | null } | null
  >();
  await Promise.all(
    [...new Set(repairs.map((repair) => repair.findingId))].map(async (id) => {
      const finding = await getFinding(id);
      findings.set(
        id,
        finding
          ? {
              code: finding.code,
              identifier: finding.asset.identifier,
              name: finding.asset.name,
            }
          : null,
      );
    }),
  );

  return repairs.map((repair) => {
    const finding = findings.get(repair.findingId) ?? null;
    return {
      ...repair,
      findingCode: finding?.code ?? null,
      assetIdentifier: finding?.identifier ?? null,
      assetName: finding?.name ?? null,
    };
  });
}

import "server-only";

import { and, eq } from "drizzle-orm";

import type { Database } from "@/db";
import { assets, users } from "@/db/schema";

/** True when this asset row belongs to the organization. */
export async function assetBelongsToOrg(
  db: Database,
  orgId: string,
  assetId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.orgId, orgId)))
    .limit(1);
  return rows.length > 0;
}

/** True when this user row belongs to the organization. */
export async function reporterBelongsToOrg(
  db: Database,
  orgId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId)))
    .limit(1);
  return rows.length > 0;
}

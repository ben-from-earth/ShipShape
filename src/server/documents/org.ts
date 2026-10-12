import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { organizations } from "@/db/schema";

import { DocumentRequestError } from "./errors";

export const ORG_ID_HEADER = "x-org-id";

/** True when a row exists in organizations. The default looks up getDb(). */
export async function organizationExists(orgId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return rows.length > 0;
}

/**
 * Refuse a UUID that is not an organization. Callers validate the UUID
 * shape first and use invalid_org_id for that failure.
 */
export async function assertOrganizationExists(
  orgId: string,
  exists: (orgId: string) => Promise<boolean> = organizationExists,
): Promise<void> {
  if (await exists(orgId)) {
    return;
  }

  throw new DocumentRequestError(
    "unknown_organization",
    "No organization exists with that id.",
    [{ path: ORG_ID_HEADER, message: "No organization exists with that id." }],
  );
}

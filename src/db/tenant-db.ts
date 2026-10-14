import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import "server-only";

import { databaseSchema, getDb, type Database } from "@/db";

import { tenants } from "./control-schema";
import { decryptDatabaseUrl } from "./tenant-secret";

const clients = new Map<string, Database>();
let control: ReturnType<typeof openControl> | undefined;

function openTenant(url: string): Database {
  return drizzle({ client: neon(url), schema: databaseSchema });
}

function openControl(url: string) {
  return drizzle({ client: neon(url), schema: { tenants } });
}

function controlDb() {
  const url = process.env.CONTROL_DATABASE_URL;
  if (!url) {
    throw new Error("CONTROL_DATABASE_URL is not set.");
  }
  control ??= openControl(url);
  return control;
}

function cached(url: string): Database {
  const existing = clients.get(url);
  if (existing) {
    return existing;
  }
  const created = openTenant(url);
  clients.set(url, created);
  return created;
}

/**
 * Drizzle client for one tenant database, cached by connection string.
 * Neon HTTP has no interactive transaction.
 *
 * When `CONTROL_DATABASE_URL` is unset, every id uses `DATABASE_URL`.
 * That is the local, CI, and first-tenant setup: today's Neon database.
 */
export async function getTenantDb(tenantId: string): Promise<Database> {
  if (!process.env.CONTROL_DATABASE_URL) {
    return getDb();
  }

  const rows = await controlDb()
    .select({ databaseUrlEncrypted: tenants.databaseUrlEncrypted })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  const stored = rows[0]?.databaseUrlEncrypted;
  if (!stored) {
    throw new Error(`Tenant ${tenantId} was not found.`);
  }
  return cached(decryptDatabaseUrl(stored));
}

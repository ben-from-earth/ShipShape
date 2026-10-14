import path from "node:path";
import { pathToFileURL } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { decryptDatabaseUrl } from "./tenant-secret";

export const tenantMigrationsFolder = path.join(process.cwd(), "migrations");
export const controlMigrationsFolder = path.join(
  process.cwd(),
  "migrations/control",
);

/**
 * Applies control migrations, then tenant migrations on every registered
 * database. With `CONTROL_DATABASE_URL` unset, migrates `DATABASE_URL` only.
 */
export async function migrateAll(): Promise<void> {
  const controlUrl = process.env.CONTROL_DATABASE_URL;
  if (!controlUrl) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Set it, or set CONTROL_DATABASE_URL to migrate every tenant.",
      );
    }
    await migrateDatabase(databaseUrl, tenantMigrationsFolder);
    return;
  }

  await migrateDatabase(controlUrl, controlMigrationsFolder);
  const urls = await tenantUrls(controlUrl);
  for (const url of urls) {
    await migrateDatabase(url, tenantMigrationsFolder);
  }
}

async function tenantUrls(controlUrl: string): Promise<string[]> {
  const pool = new pg.Pool({ connectionString: controlUrl });
  try {
    const result = await pool.query<{ database_url_encrypted: string }>(
      "select database_url_encrypted from tenants",
    );
    return result.rows.map((row) =>
      decryptDatabaseUrl(row.database_url_encrypted),
    );
  } finally {
    await pool.end();
  }
}

/** Applies one migrations folder to one Postgres database. */
export async function migrateDatabase(
  url: string,
  migrationsFolder: string,
): Promise<void> {
  const pool = new pg.Pool({ connectionString: url });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  migrateAll().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

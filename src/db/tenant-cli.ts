import { pathToFileURL } from "node:url";

import pg from "pg";

import { storageConfigFromEnv, storageConfigPayload } from "../storage/config";
import {
  controlMigrationsFolder,
  migrateDatabase,
  tenantMigrationsFolder,
} from "./migrate-all";
import {
  INSERT_TENANT_SQL,
  LIST_TENANTS_SQL,
  formatRegistered,
  formatTenantList,
  isUniqueViolation,
  parseTenantArgs,
  registerTenant,
  resolveDatabaseUrl,
  type TenantListRow,
} from "./tenant-admin";
import { runBackupCommand } from "./tenant-backup";
import { encryptDatabaseUrl } from "./tenant-secret";

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);
  if (command === "backup" || command === "restore") {
    process.stdout.write(`${await runBackupCommand(process.argv.slice(2))}\n`);
    return;
  }

  const parsed = parseTenantArgs(process.argv.slice(2));
  if (parsed.command === "list") {
    process.stdout.write(`${await listTenants()}\n`);
    return;
  }

  const databaseUrl = resolveDatabaseUrl({
    urlFlag: parsed.urlFlag,
    env: process.env,
    stdin: parsed.urlFlag === "-" ? await readStdin() : undefined,
  });
  const storage = parsed.storage
    ? {
        storageKind: parsed.storage,
        storageConfigEncrypted: encryptDatabaseUrl(
          storageConfigPayload(
            storageConfigFromEnv(parsed.storage, process.env),
          ),
        ),
      }
    : {};
  const registered = await registerTenant(
    { slug: parsed.slug, name: parsed.name, databaseUrl, ...storage },
    {
      migrateControl: () =>
        migrateDatabase(controlDatabaseUrl(), controlMigrationsFolder),
      encrypt: encryptDatabaseUrl,
      insert: (row) => insertTenant(row),
      migrateTenant: (url) => migrateDatabase(url, tenantMigrationsFolder),
    },
  );
  process.stdout.write(`${formatRegistered(registered)}\n`);
}

async function listTenants(): Promise<string> {
  const pool = new pg.Pool({ connectionString: controlDatabaseUrl() });
  try {
    const result = await pool.query<{
      id: string;
      slug: string;
      name: string;
      created_at: Date | string;
    }>(LIST_TENANTS_SQL);
    const rows: TenantListRow[] = result.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      createdAt: asTimestamp(row.created_at),
    }));
    return formatTenantList(rows);
  } finally {
    await pool.end();
  }
}

async function insertTenant(row: {
  slug: string;
  name: string;
  databaseUrlEncrypted: string;
  storageKind: "local" | "s3";
  storageConfigEncrypted: string | null;
}): Promise<{ id: string } | "exists"> {
  const pool = new pg.Pool({ connectionString: controlDatabaseUrl() });
  try {
    const result = await pool.query<{ id: string }>(INSERT_TENANT_SQL, [
      row.slug,
      row.name,
      row.databaseUrlEncrypted,
      row.storageKind,
      row.storageConfigEncrypted,
    ]);
    const id = result.rows[0]?.id;
    if (!id) {
      throw new Error("Tenant insert returned no id.");
    }
    return { id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return "exists";
    }
    throw error;
  } finally {
    await pool.end();
  }
}

function controlDatabaseUrl(): string {
  const url = process.env.CONTROL_DATABASE_URL?.trim();
  if (!url) {
    throw new Error("CONTROL_DATABASE_URL is not set.");
  }
  return url;
}

function asTimestamp(value: Date | string): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new Error("Tenant created_at is invalid.");
  }
  return instant.toISOString();
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Tenant command failed.";
    console.error(message);
    process.exitCode = 1;
  });
}

import path from "node:path";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { databaseSchema, type Database } from "@/db";

/** True only for a loopback host. Neon and every other host are rejected. */
export function isLoopbackDatabaseUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

/**
 * Opens a node-postgres client and applies the committed migrations.
 * Refuses any URL that is not loopback, so a Neon `DATABASE_URL` cannot
 * be used by accident.
 */
export async function openIntegrationDatabase(url: string): Promise<{
  db: Database;
  close: () => Promise<void>;
}> {
  if (!isLoopbackDatabaseUrl(url)) {
    throw new Error(
      "Integration tests refuse any database that is not on localhost.",
    );
  }

  const pool = new pg.Pool({ connectionString: url });
  const nodeDb = drizzle({ client: pool, schema: databaseSchema });
  await migrate(nodeDb, {
    migrationsFolder: path.join(process.cwd(), "migrations"),
  });

  return {
    db: nodeDb as unknown as Database,
    close: async () => {
      await pool.end();
    },
  };
}

export async function emptyDatabase(db: Database): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE organizations CASCADE`);
}

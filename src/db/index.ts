import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import "server-only";

import * as relations from "./relations";
import * as schema from "./schema";

/** Tables plus relations, so `getDb().query` can follow foreign keys. */
export const databaseSchema = { ...schema, ...relations };

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.",
    );
  }

  return drizzle({ client: neon(databaseUrl), schema: databaseSchema });
}

export type Database = ReturnType<typeof createDb>;

let database: Database | undefined;

/**
 * Opens a Neon HTTP connection on first use.
 * Importing this module does not require DATABASE_URL, so build and CI
 * can run without a database.
 */
export function getDb(): Database {
  database ??= createDb();
  return database;
}

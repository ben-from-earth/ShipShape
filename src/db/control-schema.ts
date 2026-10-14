import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const STORAGE_KINDS = ["local", "s3"] as const;

export const storageKindEnum = pgEnum("storage_kind", STORAGE_KINDS);

/**
 * Control-plane registry. One row is one tenant database.
 * `database_url_encrypted` is AES-256-GCM ciphertext, not a connection string.
 */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    databaseUrlEncrypted: text("database_url_encrypted").notNull(),
    storageKind: storageKindEnum("storage_kind").notNull().default("local"),
    storageConfigEncrypted: text("storage_config_encrypted"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("tenants_slug_uq").on(table.slug)],
);

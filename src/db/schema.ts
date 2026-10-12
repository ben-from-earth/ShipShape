import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Stand-in table so Drizzle Kit has a schema to read.
 * Replace this file with the domain tables: damage reports, repairs,
 * analyses, reviews, and documents. Do not store product data here.
 *
 * Document embeddings are 384-dimensional vectors from all-MiniLM-L6-v2.
 * src/server/documents/embed.ts produces them. Store them with pgvector
 * when the document tables replace this placeholder. See src/schemas/document.ts.
 */
export const schemaPlaceholder = pgTable("schema_placeholder", {
  id: uuid("id").primaryKey().defaultRandom(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

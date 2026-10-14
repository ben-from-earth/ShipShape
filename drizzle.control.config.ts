import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.CONTROL_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "CONTROL_DATABASE_URL is not set. Point it at the control Postgres database.",
  );
}

export default defineConfig({
  schema: "./src/db/control-schema.ts",
  out: "./migrations/control",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});

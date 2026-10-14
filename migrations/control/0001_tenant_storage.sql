CREATE TYPE "public"."storage_kind" AS ENUM('local', 's3');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "storage_kind" "storage_kind" DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "storage_config_encrypted" text;
CREATE TYPE "public"."issue_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "severity" "issue_severity" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "severity" DROP DEFAULT;

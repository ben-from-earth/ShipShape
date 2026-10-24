ALTER TABLE "repairs" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "repairs" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
UPDATE "repairs" SET "status" = 'draft' WHERE "status" = 'open';--> statement-breakpoint
UPDATE "repairs" SET "status" = 'complete' WHERE "status" = 'completed';--> statement-breakpoint
DROP TYPE "public"."repair_status";--> statement-breakpoint
CREATE TYPE "public"."repair_status" AS ENUM('draft', 'written', 'in_review', 'approved', 'awaiting_analysis', 'analysis_approved', 'complete');--> statement-breakpoint
ALTER TABLE "repairs" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."repair_status";--> statement-breakpoint
ALTER TABLE "repairs" ALTER COLUMN "status" SET DATA TYPE "public"."repair_status" USING "status"::"public"."repair_status";

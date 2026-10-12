CREATE TYPE "public"."repair_status" AS ENUM('open', 'in_review', 'completed');--> statement-breakpoint
CREATE SEQUENCE "public"."repair_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1002 CACHE 1;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "status" "repair_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repairs_issue_idx" ON "repairs" USING btree ("issue_id");--> statement-breakpoint
-- Existing codes may be REP- or an older prefix such as RPR-. setval(..., max_code)
-- makes the next nextval max_code + 1, including when this migration runs against rows
-- that already exist. Codes that are not prefix-digits are ignored.
SELECT setval(
  'public.repair_code_seq',
  GREATEST(
    1001::bigint,
    COALESCE(
      (
        SELECT MAX(substring(code FROM '^[A-Za-z]+-([0-9]+)$')::bigint)
        FROM "repairs"
        WHERE code ~ '^[A-Za-z]+-[0-9]+$'
      ),
      1001::bigint
    )
  )
);
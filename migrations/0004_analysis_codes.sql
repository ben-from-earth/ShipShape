CREATE SEQUENCE "public"."analysis_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1002 CACHE 1;--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyses_revision_idx" ON "analyses" USING btree ("repair_revision_id");--> statement-breakpoint
-- Existing codes may be AN- or an older prefix such as XYZ-. setval(..., max_code)
-- makes the next nextval max_code + 1, including when this migration runs against rows
-- that already exist. Codes that are not prefix-digits are ignored. The floor is 1001
-- so the next code is at least AN-1002, past the demo seed AN-1001.
SELECT setval(
  'public.analysis_code_seq',
  GREATEST(
    1001::bigint,
    COALESCE(
      (
        SELECT MAX(substring(code FROM '^[A-Za-z]+-([0-9]+)$')::bigint)
        FROM "analyses"
        WHERE code ~ '^[A-Za-z]+-[0-9]+$'
      ),
      1001::bigint
    )
  )
);
CREATE SEQUENCE "public"."issue_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1002 CACHE 1;
--> statement-breakpoint
-- Demo seed uses ISS-1001. setval(..., max_code) makes the next nextval max_code + 1,
-- including when this migration runs against rows that already exist.
SELECT setval(
  'public.issue_code_seq',
  GREATEST(
    1001::bigint,
    COALESCE(
      (
        SELECT MAX(substring(code FROM '^ISS-([0-9]+)$')::bigint)
        FROM "issues"
        WHERE code ~ '^ISS-[0-9]+$'
      ),
      1001::bigint
    )
  )
);
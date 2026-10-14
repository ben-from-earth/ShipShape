ALTER TABLE "analysis_attachments" DROP CONSTRAINT "analysis_attachments_source_ck";--> statement-breakpoint
ALTER TABLE "analysis_attachments" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "analysis_attachments" ADD CONSTRAINT "analysis_attachments_source_ck" CHECK ((
        ("analysis_attachments"."document_id" IS NOT NULL AND "analysis_attachments"."storage_key" IS NULL AND "analysis_attachments"."file_name" IS NULL AND "analysis_attachments"."url" IS NULL AND "analysis_attachments"."content_type" IS NULL AND "analysis_attachments"."size" IS NULL)
        OR
        ("analysis_attachments"."document_id" IS NULL AND "analysis_attachments"."storage_key" IS NULL AND "analysis_attachments"."file_name" IS NOT NULL AND "analysis_attachments"."url" IS NOT NULL AND "analysis_attachments"."content_type" IS NOT NULL AND "analysis_attachments"."size" IS NOT NULL)
        OR
        ("analysis_attachments"."document_id" IS NULL AND "analysis_attachments"."storage_key" IS NOT NULL AND "analysis_attachments"."file_name" IS NOT NULL AND "analysis_attachments"."url" IS NULL AND "analysis_attachments"."content_type" IS NOT NULL AND "analysis_attachments"."size" IS NOT NULL)
      ));
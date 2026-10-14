CREATE TYPE "public"."engineer_role" AS ENUM('analyst', 'reviewer', 'approver');--> statement-breakpoint
CREATE TYPE "public"."engineering_analysis_status" AS ENUM('unassigned', 'assigned', 'in_progress', 'waiting_for_review', 'in_review', 'approved');--> statement-breakpoint
CREATE TABLE "analysis_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"document_id" uuid,
	"file_name" text,
	"url" text,
	"content_type" text,
	"size" integer,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_attachments_source_ck" CHECK ((
        ("analysis_attachments"."document_id" IS NOT NULL AND "analysis_attachments"."file_name" IS NULL AND "analysis_attachments"."url" IS NULL AND "analysis_attachments"."content_type" IS NULL AND "analysis_attachments"."size" IS NULL)
        OR
        ("analysis_attachments"."document_id" IS NULL AND "analysis_attachments"."file_name" IS NOT NULL AND "analysis_attachments"."url" IS NOT NULL AND "analysis_attachments"."content_type" IS NOT NULL AND "analysis_attachments"."size" IS NOT NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "analysis_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineering_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"status" "engineering_analysis_status" DEFAULT 'unassigned' NOT NULL,
	"assignee_id" uuid,
	"due_date" date,
	"approved_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "engineer_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_attachments" ADD CONSTRAINT "analysis_attachments_analysis_id_engineering_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."engineering_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_attachments" ADD CONSTRAINT "analysis_attachments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_attachments" ADD CONSTRAINT "analysis_attachments_uploaded_by_engineers_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."engineers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_comments" ADD CONSTRAINT "analysis_comments_analysis_id_engineering_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."engineering_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_comments" ADD CONSTRAINT "analysis_comments_author_id_engineers_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."engineers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_analyses" ADD CONSTRAINT "engineering_analyses_assignee_id_engineers_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."engineers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineering_analyses" ADD CONSTRAINT "engineering_analyses_created_by_engineers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."engineers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analysis_attachments_analysis_idx" ON "analysis_attachments" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "analysis_comments_analysis_idx" ON "analysis_comments" USING btree ("analysis_id");--> statement-breakpoint
CREATE UNIQUE INDEX "engineering_analyses_code_uq" ON "engineering_analyses" USING btree ("code");--> statement-breakpoint
CREATE INDEX "engineering_analyses_status_idx" ON "engineering_analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "engineering_analyses_due_date_idx" ON "engineering_analyses" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "engineers_email_uq" ON "engineers" USING btree ("email");
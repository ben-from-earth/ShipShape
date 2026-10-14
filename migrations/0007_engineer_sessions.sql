CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"engineer_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engineers" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_engineer_id_engineers_id_fk" FOREIGN KEY ("engineer_id") REFERENCES "public"."engineers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_engineer_idx" ON "sessions" USING btree ("engineer_id");
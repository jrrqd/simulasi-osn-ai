CREATE TABLE IF NOT EXISTS "problem_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"payload" jsonb,
	"hidden" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "problem_overrides" ADD CONSTRAINT "problem_overrides_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

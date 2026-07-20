ALTER TABLE "generated_problems" ADD COLUMN IF NOT EXISTS "difficulty_mode" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_problems" ADD COLUMN IF NOT EXISTS "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generated_problems_pool_idx" ON "generated_problems" USING btree ("track","topic","created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generated_mocks" (
	"id" text PRIMARY KEY NOT NULL,
	"created_by" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"difficulty_mode" text DEFAULT 'medium' NOT NULL,
	"problem_ids" jsonb NOT NULL,
	"track" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generated_mocks" ADD CONSTRAINT "generated_mocks_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generated_mocks_created_by_idx" ON "generated_mocks" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "generated_mocks_created_at_idx" ON "generated_mocks" USING btree ("created_at");

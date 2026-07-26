CREATE TABLE IF NOT EXISTS "countdown_phases" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"date_label" text NOT NULL,
	"at" text NOT NULL,
	"ends_at" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "countdown_phases_sort_idx" ON "countdown_phases" USING btree ("sort_order","at");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "countdown_phases" ADD CONSTRAINT "countdown_phases_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

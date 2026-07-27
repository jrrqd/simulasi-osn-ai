ALTER TABLE "mock_sessions" ADD COLUMN IF NOT EXISTS "integrity_events" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_sessions" ADD COLUMN IF NOT EXISTS "integrity_violation_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_sessions" ADD COLUMN IF NOT EXISTS "integrity_flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "mock_sessions" ADD COLUMN IF NOT EXISTS "integrity_forced_submit" boolean DEFAULT false NOT NULL;

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "birth_date" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "school_name" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "grade" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamptz;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "profile_prompt_snoozed_until" timestamptz;

--> Mark accounts that already existed before this feature as onboarded
UPDATE "user"
SET "onboarding_completed_at" = COALESCE("created_at", now())
WHERE "onboarding_completed_at" IS NULL;

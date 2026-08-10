import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema";

type AppDb =
  | ReturnType<typeof drizzlePg<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

// Next may evaluate this module more than once per process. PGlite only
// supports one live instance per data dir, so pin the singleton on globalThis.
const globalForDb = globalThis as typeof globalThis & {
  __osnaiDb?: AppDb;
  __osnaiDbInit?: Promise<AppDb>;
};

async function migratePglite(client: PGlite) {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS "user" (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      email_verified boolean NOT NULL DEFAULT false,
      image text,
      role text NOT NULL DEFAULT 'student',
      banned boolean NOT NULL DEFAULT false,
      ban_reason text,
      ban_expires timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'student';
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ban_reason text;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ban_expires timestamptz;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS birth_date text;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS school_name text;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS grade text;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS city text;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS profile_prompt_snoozed_until timestamptz;
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS assistant_pet text NOT NULL DEFAULT 'cat';
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'pre-seleksi';
    CREATE TABLE IF NOT EXISTS session (
      id text PRIMARY KEY,
      expires_at timestamptz NOT NULL,
      token text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      ip_address text,
      user_agent text,
      impersonated_by text,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    );
    ALTER TABLE session ADD COLUMN IF NOT EXISTS impersonated_by text;
    CREATE TABLE IF NOT EXISTS account (
      id text PRIMARY KEY,
      account_id text NOT NULL,
      provider_id text NOT NULL,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      access_token text,
      refresh_token text,
      id_token text,
      access_token_expires_at timestamptz,
      refresh_token_expires_at timestamptz,
      scope text,
      password text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS verification (
      id text PRIMARY KEY,
      identifier text NOT NULL,
      value text NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      problem_id text NOT NULL,
      source text NOT NULL DEFAULT 'curated',
      track text NOT NULL,
      topic text NOT NULL,
      difficulty integer NOT NULL DEFAULT 2,
      answer_type text NOT NULL,
      submitted_answer jsonb NOT NULL,
      is_correct boolean NOT NULL,
      score double precision NOT NULL,
      max_score double precision NOT NULL DEFAULT 1,
      duration_ms integer NOT NULL DEFAULT 0,
      mock_session_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS attempts_user_idx ON attempts(user_id);
    CREATE INDEX IF NOT EXISTS attempts_user_topic_idx ON attempts(user_id, topic);
    CREATE TABLE IF NOT EXISTS mock_sessions (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      mock_id text NOT NULL,
      status text NOT NULL DEFAULT 'in_progress',
      answers jsonb NOT NULL DEFAULT '{}',
      score double precision,
      max_score double precision,
      started_at timestamptz NOT NULL DEFAULT now(),
      ends_at timestamptz NOT NULL,
      submitted_at timestamptz,
      integrity_events jsonb NOT NULL DEFAULT '[]',
      integrity_violation_count integer NOT NULL DEFAULT 0,
      integrity_flagged boolean NOT NULL DEFAULT false,
      integrity_forced_submit boolean NOT NULL DEFAULT false
    );
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS integrity_events jsonb NOT NULL DEFAULT '[]';
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS integrity_violation_count integer NOT NULL DEFAULT 0;
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS integrity_flagged boolean NOT NULL DEFAULT false;
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS integrity_forced_submit boolean NOT NULL DEFAULT false;
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS score_summary jsonb;
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS total_attempts integer NOT NULL DEFAULT 0;
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS penalty_minutes integer NOT NULL DEFAULT 0;
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS last_submit_at timestamptz;
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS penalty_state jsonb NOT NULL DEFAULT '{}';
    CREATE INDEX IF NOT EXISTS mock_sessions_user_idx ON mock_sessions(user_id);
    CREATE TABLE IF NOT EXISTS submission_events (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      mock_session_id text NOT NULL REFERENCES mock_sessions(id) ON DELETE CASCADE,
      problem_id text NOT NULL,
      kind text NOT NULL,
      correct boolean,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS submission_events_session_idx ON submission_events(mock_session_id);
    CREATE INDEX IF NOT EXISTS submission_events_user_idx ON submission_events(user_id);
    CREATE TABLE IF NOT EXISTS topic_mastery (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      track text NOT NULL,
      topic text NOT NULL,
      mastery double precision NOT NULL DEFAULT 0,
      attempts_count integer NOT NULL DEFAULT 0,
      correct_count integer NOT NULL DEFAULT 0,
      avg_duration_ms integer NOT NULL DEFAULT 0,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS topic_mastery_user_topic_uidx ON topic_mastery(user_id, topic);
    CREATE TABLE IF NOT EXISTS ai_provider_settings (
      id text PRIMARY KEY,
      user_id text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
      base_url text NOT NULL,
      model_id text NOT NULL,
      api_key_ciphertext text NOT NULL,
      api_key_iv text NOT NULL,
      api_key_tag text NOT NULL,
      last_tested_at timestamptz,
      last_test_ok boolean,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS system_ai_provider_settings (
      id text PRIMARY KEY DEFAULT 'default',
      base_url text NOT NULL,
      model_id text NOT NULL,
      api_key_ciphertext text NOT NULL,
      api_key_iv text NOT NULL,
      api_key_tag text NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      last_tested_at timestamptz,
      last_test_ok boolean,
      updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS generated_problems (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      payload jsonb NOT NULL,
      track text NOT NULL,
      topic text NOT NULL,
      difficulty integer NOT NULL,
      difficulty_mode text NOT NULL DEFAULT 'medium',
      title text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE generated_problems ADD COLUMN IF NOT EXISTS difficulty_mode text NOT NULL DEFAULT 'medium';
    ALTER TABLE generated_problems ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '';
    CREATE INDEX IF NOT EXISTS generated_problems_user_idx ON generated_problems(user_id);
    CREATE INDEX IF NOT EXISTS generated_problems_pool_idx ON generated_problems(track, topic, created_at);
    CREATE TABLE IF NOT EXISTS generated_mocks (
      id text PRIMARY KEY,
      created_by text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text NOT NULL DEFAULT '',
      duration_minutes integer NOT NULL DEFAULT 30,
      difficulty_mode text NOT NULL DEFAULT 'medium',
      problem_ids jsonb NOT NULL,
      track text NOT NULL,
      kind text NOT NULL DEFAULT 'ai',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE generated_mocks ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'ai';
    ALTER TABLE generated_mocks ADD COLUMN IF NOT EXISTS penalty_enabled boolean NOT NULL DEFAULT true;
    ALTER TABLE generated_mocks ADD COLUMN IF NOT EXISTS penalty_minutes_per_wrong integer NOT NULL DEFAULT 1;
    CREATE INDEX IF NOT EXISTS generated_mocks_created_by_idx ON generated_mocks(created_by);
    CREATE INDEX IF NOT EXISTS generated_mocks_created_at_idx ON generated_mocks(created_at);
    CREATE TABLE IF NOT EXISTS review_threads (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      problem_id text NOT NULL,
      attempt_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS review_messages (
      id text PRIMARY KEY,
      thread_id text NOT NULL REFERENCES review_threads(id) ON DELETE CASCADE,
      role text NOT NULL,
      content text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      lesson_id text NOT NULL,
      status text NOT NULL DEFAULT 'in_progress',
      checks_passed jsonb NOT NULL DEFAULT '{}',
      completed_at timestamptz,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS lesson_progress_user_lesson_uidx ON lesson_progress(user_id, lesson_id);
    CREATE INDEX IF NOT EXISTS lesson_progress_user_idx ON lesson_progress(user_id);
    CREATE TABLE IF NOT EXISTS check_attempts (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      lesson_id text NOT NULL,
      question_id text NOT NULL,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      correct_count integer NOT NULL DEFAULT 0,
      wrong_streak integer NOT NULL DEFAULT 0,
      ease double precision NOT NULL DEFAULT 2.5,
      interval_days double precision NOT NULL DEFAULT 0,
      due_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS check_attempts_user_lesson_q_uidx
      ON check_attempts(user_id, lesson_id, question_id);
    CREATE INDEX IF NOT EXISTS check_attempts_user_due_idx
      ON check_attempts(user_id, due_at);
    CREATE TABLE IF NOT EXISTS generated_lesson_checks (
      id text PRIMARY KEY,
      lesson_id text NOT NULL,
      payload jsonb NOT NULL,
      hidden boolean NOT NULL DEFAULT false,
      created_by text REFERENCES "user"(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS generated_lesson_checks_lesson_idx
      ON generated_lesson_checks(lesson_id);
    CREATE TABLE IF NOT EXISTS problem_overrides (
      id text PRIMARY KEY,
      payload jsonb,
      hidden boolean NOT NULL DEFAULT false,
      updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS mock_overrides (
      id text PRIMARY KEY,
      payload jsonb,
      hidden boolean NOT NULL DEFAULT false,
      updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS countdown_phases (
      id text PRIMARY KEY,
      label text NOT NULL,
      date_label text NOT NULL,
      at text NOT NULL,
      ends_at text,
      sort_order integer NOT NULL DEFAULT 0,
      enabled boolean NOT NULL DEFAULT true,
      updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS countdown_phases_sort_idx ON countdown_phases(sort_order, at);
    CREATE TABLE IF NOT EXISTS ioai_resources (
      id text PRIMARY KEY,
      category text NOT NULL,
      title text NOT NULL,
      url text NOT NULL,
      region text,
      year integer,
      domains jsonb NOT NULL DEFAULT '[]',
      topics jsonb NOT NULL DEFAULT '[]',
      summary text NOT NULL DEFAULT '',
      prompt_hint text,
      source text NOT NULL DEFAULT 'curated',
      hidden boolean NOT NULL DEFAULT false,
      updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ioai_resources_category_idx ON ioai_resources(category);
    CREATE INDEX IF NOT EXISTS ioai_resources_hidden_idx ON ioai_resources(hidden);
    CREATE TABLE IF NOT EXISTS ioai_guides (
      id text PRIMARY KEY,
      resource_id text NOT NULL REFERENCES ioai_resources(id) ON DELETE CASCADE,
      title text NOT NULL,
      ringkasan text NOT NULL DEFAULT '',
      kunci_jawaban text NOT NULL DEFAULT '',
      pembahasan text NOT NULL DEFAULT '',
      original_url text NOT NULL,
      solution_url text,
      credit text NOT NULL DEFAULT '',
      topics jsonb NOT NULL DEFAULT '[]',
      hidden boolean NOT NULL DEFAULT false,
      updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ioai_guides_resource_idx ON ioai_guides(resource_id);
    CREATE INDEX IF NOT EXISTS ioai_guides_hidden_idx ON ioai_guides(hidden);
  `);
}

async function createDb(): Promise<AppDb> {
  const usePglite =
    process.env.USE_PGLITE === "true" ||
    !process.env.DATABASE_URL ||
    process.env.DATABASE_URL.startsWith("pglite:");

  if (usePglite) {
    // In-memory by default for reliability in Next.js; set PGLITE_DATA_DIR to persist.
    const dataDir = process.env.PGLITE_DATA_DIR;
    if (dataDir) {
      mkdirSync(dirname(dataDir), { recursive: true });
      mkdirSync(dataDir, { recursive: true });
    }
    const client = dataDir ? new PGlite(dataDir) : new PGlite();
    await client.waitReady;
    await migratePglite(client);
    return drizzlePglite(client, { schema });
  }

  const url = process.env.DATABASE_URL!;
  const client = postgres(url, { max: 10 });
  // Soft-migrate additive columns/tables (Postgres prod does not run PGlite migrate).
  await client.unsafe(`
    ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'pre-seleksi';
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS score_summary jsonb;
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS total_attempts integer NOT NULL DEFAULT 0;
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS penalty_minutes integer NOT NULL DEFAULT 0;
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS last_submit_at timestamptz;
    ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS penalty_state jsonb NOT NULL DEFAULT '{}';
    CREATE TABLE IF NOT EXISTS submission_events (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      mock_session_id text NOT NULL REFERENCES mock_sessions(id) ON DELETE CASCADE,
      problem_id text NOT NULL,
      kind text NOT NULL,
      correct boolean,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS submission_events_session_idx ON submission_events(mock_session_id);
    CREATE INDEX IF NOT EXISTS submission_events_user_idx ON submission_events(user_id);
    ALTER TABLE generated_mocks ADD COLUMN IF NOT EXISTS penalty_enabled boolean NOT NULL DEFAULT true;
    ALTER TABLE generated_mocks ADD COLUMN IF NOT EXISTS penalty_minutes_per_wrong integer NOT NULL DEFAULT 1;
    ALTER TABLE generated_mocks ALTER COLUMN penalty_minutes_per_wrong SET DEFAULT 1;
    UPDATE generated_mocks
      SET penalty_minutes_per_wrong = 1
      WHERE penalty_minutes_per_wrong = 20;
    CREATE TABLE IF NOT EXISTS check_attempts (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      lesson_id text NOT NULL,
      question_id text NOT NULL,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      correct_count integer NOT NULL DEFAULT 0,
      wrong_streak integer NOT NULL DEFAULT 0,
      ease double precision NOT NULL DEFAULT 2.5,
      interval_days double precision NOT NULL DEFAULT 0,
      due_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS check_attempts_user_lesson_q_uidx
      ON check_attempts(user_id, lesson_id, question_id);
    CREATE INDEX IF NOT EXISTS check_attempts_user_due_idx
      ON check_attempts(user_id, due_at);
    CREATE TABLE IF NOT EXISTS generated_lesson_checks (
      id text PRIMARY KEY,
      lesson_id text NOT NULL,
      payload jsonb NOT NULL,
      hidden boolean NOT NULL DEFAULT false,
      created_by text REFERENCES "user"(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS generated_lesson_checks_lesson_idx
      ON generated_lesson_checks(lesson_id);
    CREATE TABLE IF NOT EXISTS ioai_resources (
      id text PRIMARY KEY,
      category text NOT NULL,
      title text NOT NULL,
      url text NOT NULL,
      region text,
      year integer,
      domains jsonb NOT NULL DEFAULT '[]',
      topics jsonb NOT NULL DEFAULT '[]',
      summary text NOT NULL DEFAULT '',
      prompt_hint text,
      source text NOT NULL DEFAULT 'curated',
      hidden boolean NOT NULL DEFAULT false,
      updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ioai_resources_category_idx ON ioai_resources(category);
    CREATE INDEX IF NOT EXISTS ioai_resources_hidden_idx ON ioai_resources(hidden);
    CREATE TABLE IF NOT EXISTS ioai_guides (
      id text PRIMARY KEY,
      resource_id text NOT NULL REFERENCES ioai_resources(id) ON DELETE CASCADE,
      title text NOT NULL,
      ringkasan text NOT NULL DEFAULT '',
      kunci_jawaban text NOT NULL DEFAULT '',
      pembahasan text NOT NULL DEFAULT '',
      original_url text NOT NULL,
      solution_url text,
      credit text NOT NULL DEFAULT '',
      topics jsonb NOT NULL DEFAULT '[]',
      hidden boolean NOT NULL DEFAULT false,
      updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ioai_guides_resource_idx ON ioai_guides(resource_id);
    CREATE INDEX IF NOT EXISTS ioai_guides_hidden_idx ON ioai_guides(hidden);
  `);
  return drizzlePg(client, { schema });
}

export async function getDb() {
  if (globalForDb.__osnaiDb) return globalForDb.__osnaiDb;
  if (!globalForDb.__osnaiDbInit) {
    globalForDb.__osnaiDbInit = createDb().then(async (db) => {
      globalForDb.__osnaiDb = db;
      try {
        const { ensureOsn26MockInDb } = await import(
          "@/lib/content/seed-osn26-mock"
        );
        await ensureOsn26MockInDb(db);
      } catch (err) {
        console.warn("[db] ensureOsn26MockInDb skipped:", err);
      }
      try {
        const { seedIoaiResourcesIfEmpty } = await import(
          "@/lib/content/seed-ioai-resources"
        );
        await seedIoaiResourcesIfEmpty(db);
      } catch (err) {
        console.warn("[db] seedIoaiResourcesIfEmpty skipped:", err);
      }
      try {
        const { seedIoaiGuidesIfEmpty } = await import(
          "@/lib/content/seed-ioai-guides"
        );
        await seedIoaiGuidesIfEmpty(db);
      } catch (err) {
        console.warn("[db] seedIoaiGuidesIfEmpty skipped:", err);
      }
      return db;
    });
  }
  return globalForDb.__osnaiDbInit;
}

export function getDbSync() {
  if (!globalForDb.__osnaiDb) {
    throw new Error("Database not initialized. Call await getDb() first.");
  }
  return globalForDb.__osnaiDb;
}

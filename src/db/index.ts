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

let _db: AppDb | null = null;
let _initPromise: Promise<AppDb> | null = null;

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
      submitted_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS mock_sessions_user_idx ON mock_sessions(user_id);
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
  return drizzlePg(client, { schema });
}

export async function getDb() {
  if (_db) return _db;
  if (!_initPromise) {
    _initPromise = createDb().then((db) => {
      _db = db;
      return db;
    });
  }
  return _initPromise;
}

export function getDbSync() {
  if (!_db) {
    throw new Error("Database not initialized. Call await getDb() first.");
  }
  return _db;
}

import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("student"),
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  birthDate: text("birth_date"),
  schoolName: text("school_name"),
  grade: text("grade"),
  city: text("city"),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  profilePromptSnoozedUntil: timestamp("profile_prompt_snoozed_until"),
  /** Floating AI assistant mascot: none | cat (Jacky) | dog (Ichi) */
  assistantPet: text("assistant_pet").notNull().default("cat"),
  /** Competition cycle: pre-seleksi | semifinal | final */
  phase: text("phase").notNull().default("pre-seleksi"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  impersonatedBy: text("impersonated_by"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const attempts = pgTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    problemId: text("problem_id").notNull(),
    source: text("source").notNull().default("curated"),
    track: text("track").notNull(),
    topic: text("topic").notNull(),
    difficulty: integer("difficulty").notNull().default(2),
    answerType: text("answer_type").notNull(),
    submittedAnswer: jsonb("submitted_answer").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    score: doublePrecision("score").notNull(),
    maxScore: doublePrecision("max_score").notNull().default(1),
    durationMs: integer("duration_ms").notNull().default(0),
    mockSessionId: text("mock_session_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("attempts_user_idx").on(t.userId),
    index("attempts_user_topic_idx").on(t.userId, t.topic),
  ],
);

export const mockSessions = pgTable(
  "mock_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mockId: text("mock_id").notNull(),
    status: text("status").notNull().default("in_progress"),
    answers: jsonb("answers").notNull().default({}),
    score: doublePrecision("score"),
    maxScore: doublePrecision("max_score"),
    /** Weighted section summary (OSN AI 2026 scoring). */
    scoreSummary: jsonb("score_summary"),
    /** ICPC-style penalty minutes (tie-breaker). */
    totalAttempts: integer("total_attempts").notNull().default(0),
    penaltyMinutes: integer("penalty_minutes").notNull().default(0),
    lastSubmitAt: timestamp("last_submit_at"),
    /** Per-problem attempt/lock state for live tracker. */
    penaltyState: jsonb("penalty_state").notNull().default({}),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endsAt: timestamp("ends_at").notNull(),
    submittedAt: timestamp("submitted_at"),
    /** Integrity audit trail for hybrid proctoring during timed mocks. */
    integrityEvents: jsonb("integrity_events").notNull().default([]),
    integrityViolationCount: integer("integrity_violation_count")
      .notNull()
      .default(0),
    integrityFlagged: boolean("integrity_flagged").notNull().default(false),
    integrityForcedSubmit: boolean("integrity_forced_submit")
      .notNull()
      .default(false),
  },
  (t) => [index("mock_sessions_user_idx").on(t.userId)],
);

/** Per-problem submit log for ICPC-style penalty / tie-breaker. */
export const submissionEvents = pgTable(
  "submission_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mockSessionId: text("mock_session_id")
      .notNull()
      .references(() => mockSessions.id, { onDelete: "cascade" }),
    problemId: text("problem_id").notNull(),
    kind: text("kind").notNull(), // submit | lock
    correct: boolean("correct"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("submission_events_session_idx").on(t.mockSessionId),
    index("submission_events_user_idx").on(t.userId),
  ],
);

export const topicMastery = pgTable(
  "topic_mastery",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    track: text("track").notNull(),
    topic: text("topic").notNull(),
    mastery: doublePrecision("mastery").notNull().default(0),
    attemptsCount: integer("attempts_count").notNull().default(0),
    correctCount: integer("correct_count").notNull().default(0),
    avgDurationMs: integer("avg_duration_ms").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("topic_mastery_user_topic_uidx").on(t.userId, t.topic),
  ],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").notNull(),
    status: text("status").notNull().default("in_progress"),
    checksPassed: jsonb("checks_passed")
      .$type<Record<string, boolean>>()
      .notNull()
      .default({}),
    completedAt: timestamp("completed_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lesson_progress_user_lesson_uidx").on(t.userId, t.lessonId),
    index("lesson_progress_user_idx").on(t.userId),
  ],
);

/** Spaced-repetition state per lesson check-question (SM-2 lite). */
export const checkAttempts = pgTable(
  "check_attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lessonId: text("lesson_id").notNull(),
    questionId: text("question_id").notNull(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    correctCount: integer("correct_count").notNull().default(0),
    wrongStreak: integer("wrong_streak").notNull().default(0),
    ease: doublePrecision("ease").notNull().default(2.5),
    intervalDays: doublePrecision("interval_days").notNull().default(0),
    dueAt: timestamp("due_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("check_attempts_user_lesson_q_uidx").on(
      t.userId,
      t.lessonId,
      t.questionId,
    ),
    index("check_attempts_user_due_idx").on(t.userId, t.dueAt),
  ],
);

/** AI/admin-generated extra check questions for a lesson (soft-deletable). */
export const generatedLessonChecks = pgTable(
  "generated_lesson_checks",
  {
    id: text("id").primaryKey(),
    lessonId: text("lesson_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    hidden: boolean("hidden").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("generated_lesson_checks_lesson_idx").on(t.lessonId),
  ],
);

export const aiProviderSettings = pgTable("ai_provider_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  baseUrl: text("base_url").notNull(),
  modelId: text("model_id").notNull(),
  apiKeyCiphertext: text("api_key_ciphertext").notNull(),
  apiKeyIv: text("api_key_iv").notNull(),
  apiKeyTag: text("api_key_tag").notNull(),
  lastTestedAt: timestamp("last_tested_at"),
  lastTestOk: boolean("last_test_ok"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const systemAiProviderSettings = pgTable("system_ai_provider_settings", {
  id: text("id").primaryKey().default("default"),
  baseUrl: text("base_url").notNull(),
  modelId: text("model_id").notNull(),
  apiKeyCiphertext: text("api_key_ciphertext").notNull(),
  apiKeyIv: text("api_key_iv").notNull(),
  apiKeyTag: text("api_key_tag").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastTestedAt: timestamp("last_tested_at"),
  lastTestOk: boolean("last_test_ok"),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const generatedProblems = pgTable(
  "generated_problems",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    track: text("track").notNull(),
    topic: text("topic").notNull(),
    difficulty: integer("difficulty").notNull(),
    difficultyMode: text("difficulty_mode").notNull().default("medium"),
    title: text("title").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("generated_problems_user_idx").on(t.userId),
    index("generated_problems_pool_idx").on(t.track, t.topic, t.createdAt),
  ],
);

/** Runtime admin edits/hides for curated (and optional AI) practice problems. */
export const problemOverrides = pgTable("problem_overrides", {
  id: text("id").primaryKey(),
  payload: jsonb("payload").$type<Record<string, unknown> | null>(),
  hidden: boolean("hidden").notNull().default(false),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const generatedMocks = pgTable(
  "generated_mocks",
  {
    id: text("id").primaryKey(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    difficultyMode: text("difficulty_mode").notNull().default("medium"),
    problemIds: jsonb("problem_ids").notNull().$type<string[]>(),
    track: text("track").notNull(),
    kind: text("kind").notNull().default("ai"),
    penaltyEnabled: boolean("penalty_enabled").notNull().default(true),
    penaltyMinutesPerWrong: integer("penalty_minutes_per_wrong")
      .notNull()
      .default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("generated_mocks_created_by_idx").on(t.createdBy),
    index("generated_mocks_created_at_idx").on(t.createdAt),
  ],
);

/** Runtime admin edits/hides for curated (and optional AI) mock exams. */
export const mockOverrides = pgTable("mock_overrides", {
  id: text("id").primaryKey(),
  payload: jsonb("payload").$type<Record<string, unknown> | null>(),
  hidden: boolean("hidden").notNull().default(false),
  updatedBy: text("updated_by").references(() => user.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Landing-page countdown milestones (admin-managed). */
export const countdownPhases = pgTable(
  "countdown_phases",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    dateLabel: text("date_label").notNull(),
    /** ISO-8601 instant, typically WIB (+07:00). */
    at: text("at").notNull(),
    endsAt: text("ends_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("countdown_phases_sort_idx").on(t.sortOrder, t.at)],
);

export const reviewThreads = pgTable("review_threads", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  problemId: text("problem_id").notNull(),
  attemptId: text("attempt_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviewMessages = pgTable("review_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id")
    .notNull()
    .references(() => reviewThreads.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

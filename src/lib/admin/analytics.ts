import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attempts,
  mockSessions,
  topicMastery,
  user,
} from "@/db/schema";
import { TOPIC_LABELS } from "@/lib/content/types";

function formatMinutes(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} menit`;
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
}

function summarizeUser(
  item: typeof user.$inferSelect,
  allAttempts: (typeof attempts.$inferSelect)[],
  allMocks: (typeof mockSessions.$inferSelect)[],
) {
  const userAttempts = allAttempts.filter((a) => a.userId === item.id);
  const userMocks = allMocks.filter((m) => m.userId === item.id);
  const totalScore = userAttempts.reduce((sum, a) => sum + a.score, 0);
  const totalMax = userAttempts.reduce((sum, a) => sum + a.maxScore, 0);
  const practiceTimeMs = userAttempts.reduce(
    (sum, a) => sum + a.durationMs,
    0,
  );
  const latestAttempt = userAttempts[0]?.createdAt;
  const latestMock = userMocks[0]?.startedAt;
  const lastActiveAt =
    latestAttempt && latestMock
      ? latestAttempt > latestMock
        ? latestAttempt
        : latestMock
      : (latestAttempt ?? latestMock ?? item.updatedAt);

  return {
    id: item.id,
    name: item.name,
    email: item.email,
    role: item.role,
    banned: item.banned,
    schoolName: item.schoolName,
    grade: item.grade,
    city: item.city,
    createdAt: item.createdAt,
    lastActiveAt,
    attemptsCount: userAttempts.length,
    accuracy: totalMax ? totalScore / totalMax : 0,
    practiceTimeMs,
    mocksCompleted: userMocks.filter((m) => m.status === "submitted").length,
  };
}

export async function buildAdminAssistantContext(focusUserId?: string) {
  const db = await getDb();
  const [users, allAttempts, allMocks] = await Promise.all([
    db.select().from(user).orderBy(asc(user.name)),
    db.select().from(attempts).orderBy(desc(attempts.createdAt)),
    db.select().from(mockSessions).orderBy(desc(mockSessions.startedAt)),
  ]);

  const summaries = users.map((item) =>
    summarizeUser(item, allAttempts, allMocks),
  );
  const students = summaries.filter((item) => item.role !== "admin");
  const activeStudents = students.filter((item) => item.attemptsCount > 0);
  const totalAttempts = students.reduce(
    (sum, item) => sum + item.attemptsCount,
    0,
  );
  const totalPracticeMs = students.reduce(
    (sum, item) => sum + item.practiceTimeMs,
    0,
  );
  const completedMocks = students.reduce(
    (sum, item) => sum + item.mocksCompleted,
    0,
  );

  const weakStudents = [...activeStudents]
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 8)
    .map(
      (s) =>
        `- ${s.name} <${s.email}> · akurasi ${Math.round(s.accuracy * 100)}% · ${s.attemptsCount} attempt · mock selesai ${s.mocksCompleted} · terakhir aktif ${s.lastActiveAt.toISOString()}`,
    )
    .join("\n");

  const topActive = [...activeStudents]
    .sort((a, b) => b.attemptsCount - a.attemptsCount)
    .slice(0, 8)
    .map(
      (s) =>
        `- ${s.name} · ${s.attemptsCount} attempt · akurasi ${Math.round(s.accuracy * 100)}% · waktu ${formatMinutes(s.practiceTimeMs)}`,
    )
    .join("\n");

  const topicStats = new Map<
    string,
    { attempts: number; score: number; max: number }
  >();
  for (const attempt of allAttempts) {
    const row = topicStats.get(attempt.topic) ?? {
      attempts: 0,
      score: 0,
      max: 0,
    };
    row.attempts += 1;
    row.score += attempt.score;
    row.max += attempt.maxScore;
    topicStats.set(attempt.topic, row);
  }
  const weakTopics = Array.from(topicStats, ([topic, stats]) => ({
    topic,
    label: TOPIC_LABELS[topic] ?? topic,
    attempts: stats.attempts,
    accuracy: stats.max ? stats.score / stats.max : 0,
  }))
    .filter((t) => t.attempts >= 3)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 10)
    .map(
      (t) =>
        `- ${t.label}: akurasi ${Math.round(t.accuracy * 100)}% (${t.attempts} attempt)`,
    )
    .join("\n");

  const recentDay = new Map<string, number>();
  for (const attempt of allAttempts.slice(0, 500)) {
    const day = attempt.createdAt.toISOString().slice(0, 10);
    recentDay.set(day, (recentDay.get(day) ?? 0) + 1);
  }
  const activityLines = Array.from(recentDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([day, count]) => `- ${day}: ${count} attempt`)
    .join("\n");

  let focusBlock = "";
  if (focusUserId) {
    const selected = users.find((item) => item.id === focusUserId);
    if (selected) {
      const summary = summarizeUser(selected, allAttempts, allMocks);
      const userAttempts = allAttempts.filter((a) => a.userId === focusUserId);
      const userMocks = allMocks.filter((m) => m.userId === focusUserId);
      const mastery = await db
        .select()
        .from(topicMastery)
        .where(eq(topicMastery.userId, focusUserId));

      const topicLines = mastery
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 12)
        .map(
          (m) =>
            `- ${TOPIC_LABELS[m.topic] ?? m.topic}: mastery ${Math.round(m.mastery * 100)}%`,
        )
        .join("\n");

      const recent = userAttempts.slice(0, 15).map(
        (a) =>
          `- ${a.createdAt.toISOString()} · ${a.topic} · skor ${a.score}/${a.maxScore} · ${a.source}`,
      );

      focusBlock = `
FOKUS PENGGUNA (halaman laporan yang sedang dibuka admin):
Nama: ${summary.name}
Email: ${summary.email}
Role: ${summary.role}
Profil: sekolah=${summary.schoolName ?? "—"}, kelas=${summary.grade ?? "—"}, kota=${summary.city ?? "—"}
Akurasi: ${Math.round(summary.accuracy * 100)}%
Attempt: ${summary.attemptsCount}
Waktu latihan: ${formatMinutes(summary.practiceTimeMs)}
Mock selesai: ${summary.mocksCompleted} / sesi mock ${userMocks.length}
Terakhir aktif: ${summary.lastActiveAt.toISOString()}

Mastery terendah:
${topicLines || "(belum ada data mastery)"}

Attempt terbaru:
${recent.join("\n") || "(belum ada attempt)"}
`;
    }
  }

  return `SNAPSHOT AKTIVITAS PLATFORM (data aktual dari database):
Total siswa: ${students.length}
Siswa aktif (punya attempt): ${activeStudents.length}
Total attempt: ${totalAttempts}
Total waktu latihan: ${formatMinutes(totalPracticeMs)}
Mock selesai (agregat): ${completedMocks}
Admin accounts: ${summaries.filter((s) => s.role === "admin").length}

Siswa paling aktif:
${topActive || "(belum ada)"}

Siswa perlu perhatian (akurasi terendah di antara yang aktif):
${weakStudents || "(belum ada)"}

Topik paling lemah (platform-wide):
${weakTopics || "(belum cukup data)"}

Aktivitas harian (14 hari terakhir yang tampak di sample):
${activityLines || "(belum ada)"}
${focusBlock}`;
}

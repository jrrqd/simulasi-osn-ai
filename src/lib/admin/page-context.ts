import { getLesson, getMock } from "@/lib/content/load";
import { resolveMock, resolveProblem } from "@/lib/content/shared";
import { TOPIC_LABELS, TRACKS } from "@/lib/content/types";

export type AdminPageContextInput = {
  pathname?: string;
  search?: string;
  focusUserId?: string;
};

function parseSearch(search?: string): URLSearchParams {
  if (!search) return new URLSearchParams();
  return new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
}

function routeLabel(pathname: string): string {
  if (pathname === "/" || pathname === "") return "Beranda";
  if (pathname === "/admin") return "Admin · Ringkasan";
  if (pathname === "/admin/users") return "Admin · Daftar pengguna";
  if (pathname.startsWith("/admin/users/")) return "Admin · Laporan pengguna";
  if (pathname === "/admin/ai") return "Admin · LLM Bersama";
  if (pathname === "/admin/countdown") return "Admin · Countdown seleksi";
  if (pathname === "/admin/problems") return "Admin · Bank soal";
  if (pathname === "/admin/mocks") return "Admin · Bank simulasi";
  if (pathname === "/admin/lessons") return "Admin · Modul belajar";
  if (pathname === "/admin/resources") return "Admin · Referensi IOAI";
  if (pathname === "/study") return "Belajar · Daftar modul";
  if (pathname.startsWith("/study/")) return "Belajar · Modul";
  if (pathname === "/practice") return "Latihan · Bank soal";
  if (pathname === "/practice/generate") return "Latihan · Generate";
  if (pathname === "/practice/ioai") return "Latihan · Arsip IOAI";
  if (pathname.startsWith("/practice/")) return "Latihan · Soal";
  if (pathname === "/mock") return "Simulasi · Bank paket";
  if (pathname === "/mock/generate") return "Simulasi · Generate";
  if (pathname.startsWith("/mock/")) return "Simulasi · Sesi";
  if (pathname === "/performance") return "Performa siswa";
  if (pathname === "/settings") return "Pengaturan";
  if (pathname.startsWith("/review/")) return "Review soal + tutor";
  if (pathname === "/onboarding") return "Onboarding";
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return "Autentikasi";
  }
  return `Halaman ${pathname}`;
}

/**
 * Describe the page the admin is viewing, enriching with lesson/problem/mock
 * metadata when IDs are present. Safe for admin system prompts.
 */
export async function buildAdminPageContext(
  input: AdminPageContextInput,
): Promise<string> {
  const pathname = (input.pathname || "/").split("?")[0] || "/";
  const params = parseSearch(input.search);
  const lines: string[] = [
    `HALAMAN YANG SEDANG DIBUKA ADMIN:`,
    `Path: ${pathname}`,
    `Label: ${routeLabel(pathname)}`,
  ];

  if (input.search) {
    lines.push(`Query: ${input.search}`);
  }

  const focusFromPath = pathname.match(/^\/admin\/users\/([^/?#]+)/)?.[1];
  const focusUserId = input.focusUserId || focusFromPath;
  if (focusUserId) {
    lines.push(`focusUserId: ${focusUserId}`);
  }

  const lessonId = pathname.match(/^\/study\/([^/?#]+)/)?.[1];
  if (lessonId) {
    const lesson = getLesson(lessonId);
    if (lesson) {
      lines.push(
        `Modul: ${lesson.title} (id=${lesson.id})`,
        `Track ${lesson.track} · topik ${TOPIC_LABELS[lesson.topic] ?? lesson.topic}`,
        `Ringkasan: ${lesson.summary}`,
      );
    } else {
      lines.push(`Modul id=${lessonId} (tidak ditemukan di silabus)`);
    }
  } else if (pathname === "/study") {
    lines.push(
      "Admin melihat indeks modul belajar (track A–D).",
      `Track: ${Object.entries(TRACKS)
        .map(([id, t]) => `${id}=${t.name}`)
        .join("; ")}`,
    );
  }

  const problemId = pathname.match(/^\/practice\/([^/?#]+)/)?.[1];
  if (problemId && problemId !== "generate" && problemId !== "ioai") {
    const problem = await resolveProblem(problemId);
    if (problem) {
      lines.push(
        `Soal: ${problem.title} (id=${problem.id})`,
        `Track ${problem.track} · ${TOPIC_LABELS[problem.topic] ?? problem.topic} · difficulty ${problem.difficulty} · type ${problem.answerType} · source ${problem.source}`,
        `Stem (ringkas): ${problem.stem.slice(0, 600)}${problem.stem.length > 600 ? "…" : ""}`,
        `Jawaban resmi: ${JSON.stringify(problem.answer)}`,
        problem.solution
          ? `Solusi (ringkas): ${problem.solution.slice(0, 400)}${problem.solution.length > 400 ? "…" : ""}`
          : "",
      );
    } else {
      lines.push(`Soal id=${problemId} (belum bisa dimuat)`);
    }
  } else if (pathname === "/practice") {
    const track = params.get("track");
    const topic = params.get("topic");
    lines.push(
      "Admin melihat bank latihan (curated + AI bersama).",
      track ? `Filter track=${track}` : "Filter track: semua",
      topic
        ? `Filter topik=${TOPIC_LABELS[topic] ?? topic}`
        : "Filter topik: semua",
    );
  } else if (pathname === "/practice/generate") {
    lines.push("Admin melihat generator soal latihan AI.");
  } else if (pathname === "/practice/ioai") {
    lines.push("Admin melihat arsip paper IOAI (latihan Kaggle-style).");
  }

  const mockId = pathname.match(/^\/mock\/([^/?#]+)/)?.[1];
  if (mockId && mockId !== "generate") {
    const curated = getMock(mockId);
    const resolved = curated ?? (await resolveMock(mockId));
    if (resolved) {
      lines.push(
        `Simulasi: ${resolved.title} (id=${resolved.id})`,
        `Durasi ${resolved.durationMinutes} menit · ${resolved.problemIds.length} soal · source ${(resolved as { source?: string }).source ?? "curated"}`,
      );
    } else {
      lines.push(`Simulasi id=${mockId} (belum bisa dimuat)`);
    }
  } else if (pathname === "/mock") {
    lines.push("Admin melihat bank paket simulasi (curated + AI).");
  } else if (pathname === "/mock/generate") {
    lines.push("Admin melihat generator paket simulasi (curated + AI).");
  }

  if (pathname === "/performance") {
    lines.push(
      "Halaman performa siswa (readiness, tren skor, mastery). Context analytics platform tetap tersedia di snapshot.",
    );
  }

  if (pathname === "/admin" || pathname === "/admin/users") {
    lines.push(
      "Fokus: analisis agregat platform / daftar siswa. Gunakan snapshot database.",
    );
  }

  if (pathname === "/admin/ai") {
    lines.push(
      "Halaman konfigurasi LLM bersama (API key platform). Jangan mengulang secret; bantu hanya soal status/kegunaan fitur.",
    );
  }

  if (pathname === "/admin/resources") {
    lines.push(
      "Admin mengelola knowledge base referensi IOAI (tautan Education Hub / olimpiade nasional).",
      "Edit/hide langsung mempengaruhi panel siswa (semifinal/final) dan blok inspirasi generate soal.",
    );
  }

  if (pathname.startsWith("/review/")) {
    const reviewProblemId = pathname.match(/^\/review\/([^/?#]+)/)?.[1];
    if (reviewProblemId) {
      const problem = await resolveProblem(reviewProblemId);
      lines.push(
        `Review soal id=${reviewProblemId}${problem ? ` · ${problem.title}` : ""}`,
      );
    }
  }

  if (pathname === "/settings") {
    lines.push(
      "Pengaturan akun/API key pribadi siswa. Admin boleh menjelaskan opsi, jangan minta password.",
    );
  }

  return lines.filter(Boolean).join("\n");
}

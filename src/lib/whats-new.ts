export type WhatsNewItem = {
  id: string;
  /** ISO 8601 — displayed in WIB on the landing page. */
  at: string;
  title: string;
  story: string;
  tag?: string;
  href?: string;
};

/**
 * Curated release notes for the landing page — newest first.
 *
 * **Required on every deploy** that ships other code changes.
 * `scripts/deploy.sh` runs `scripts/check-whats-new.sh` and blocks if this
 * file was not updated since the last `deploy/production` tag.
 *
 * Add a new object at the top with today's WIB timestamp before deploying.
 */
export const WHATS_NEW: WhatsNewItem[] = [
  {
    id: "coding-judge0-fullscreen",
    at: "2026-08-10T08:00:00+07:00",
    tag: "Simulasi",
    title: "Penilaian coding lebih adil",
    story:
      "Test case soal coding tidak lagi terlihat saat ujian — jawaban dinilai server-side dengan Judge0. Submit di mode layar penuh juga sudah diperbaiki.",
    href: "/mock",
  },
  {
    id: "kaggle-style-mocks",
    at: "2026-08-09T18:00:00+07:00",
    tag: "Simulasi",
    title: "Mode Kaggle style & semifinal",
    story:
      "Pilih simulasi 150 atau 300 menit dengan tiga soal coding panjang ala kompetisi. Ada juga tingkat semifinal dan label bank soal yang lebih jelas.",
    href: "/mock",
  },
  {
    id: "ai-figures-json",
    at: "2026-08-09T12:00:00+07:00",
    tag: "AI",
    title: "Generate simulasi AI lebih stabil",
    story:
      "Figur geometri bisa digambar otomatis lewat MiniMax image-01. Pipeline JSON untuk generate soal diperkuat supaya hasilnya lebih konsisten.",
    href: "/mock",
  },
  {
    id: "semifinal-syllabus",
    at: "2026-08-06T10:00:00+07:00",
    tag: "Kurikulum",
    title: "Silabus semifinal 2026",
    story:
      "Simulasi mengikuti fase seleksi OSN AI 2026 — materi semifinal disesuaikan dengan tahap yang sedang berjalan.",
    href: "/study",
  },
  {
    id: "python-runner-integrity",
    at: "2026-07-28T14:00:00+07:00",
    tag: "Simulasi",
    title: "Python runner & aturan ujian",
    story:
      "Kerjakan kode langsung di simulasi berwaktu. Integritas ujian difokuskan ke tab yang tersembunyi, dan penalti jawaban salah diturunkan menjadi +1 menit.",
    href: "/mock",
  },
  {
    id: "performance-assistants",
    at: "2026-07-26T11:00:00+07:00",
    tag: "Asisten",
    title: "Pelacak performa & pet asisten",
    story:
      "Dashboard performa dengan tren sesi, plus asisten mengambang Jacky atau Ichi di halaman belajar dan performa untuk bimbingan kontekstual.",
    href: "/performance",
  },
  {
    id: "onboarding-profile",
    at: "2026-07-24T09:00:00+07:00",
    tag: "Akun",
    title: "Onboarding & profil siswa",
    story:
      "Pengguna baru diarahkan mengisi profil sekolah dan tujuan belajar supaya rekomendasi latihan lebih relevan.",
    href: "/register",
  },
];

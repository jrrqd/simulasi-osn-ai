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
    id: "ui-consistency-nav-headers",
    at: "2026-08-17T12:49:00+07:00",
    tag: "Navigasi",
    title: "Navigasi & halaman lebih selaras",
    story:
      "Tab Latihan/Simulasi kini setara dengan bar Admin (full-width di bawah header). Menu atas, tab sekunder, dan chip filter menandai halaman aktif. Judul halaman seragam; Generate Simulasi memisahkan susun curated vs generate AI.",
    href: "/practice",
  },
  {
    id: "section-subnav-fullwidth",
    at: "2026-08-17T12:35:00+07:00",
    tag: "Navigasi",
    title: "Tab Latihan & Simulasi full-width",
    story:
      "Bar tab sekunder Latihan/Simulasi sekarang selebar layar, lebih ringkas, dan tab aktif terbaca jelas (teks gelap di pill putih).",
    href: "/practice",
  },
  {
    id: "latihan-simulasi-subnav-ioai-arsip",
    at: "2026-08-17T12:15:00+07:00",
    tag: "Navigasi",
    title: "Latihan & Simulasi lebih rapi + arsip IOAI",
    story:
      "Latihan dan Simulasi punya tab sekunder: Bank terpisah dari Generate. Di Latihan ada Arsip IOAI — kerjakan analog Kaggle-style paper resmi di platform (Notebook + Submit CSV + pembahasan). Generate Final IOAI bisa mengikuti year pack 2024–2026.",
    href: "/practice/ioai",
  },
  {
    id: "final-ioai-difficulty",
    at: "2026-08-13T14:05:00+07:00",
    tag: "Simulasi",
    title: "Kesulitan Final (IOAI) & marathon 5 jam",
    story:
      "Generate simulasi AI punya mode Final (IOAI) mengikuti silabus IOAI 2025 (Python, ML, CV, NLP, etika). Pilihan Kaggle tetap 3 kompetisi · 150 menit, plus opsi baru Final IOAI · 5 kompetisi · 5 jam — satu kompetisi per pilar silabus.",
    href: "/mock/generate",
  },
  {
    id: "kaggle-inplatform-notebook",
    at: "2026-08-10T14:10:00+07:00",
    tag: "Simulasi",
    title: "Notebook Kaggle langsung di platform",
    story:
      "Simulasi Kaggle/IOAI kini bisa dikerjakan tanpa keluar ke VS Code atau Colab: tab Notebook menjalankan Python + pandas di browser (Pyodide), memuat CSV otomatis, lalu menghasilkan submission.csv untuk dinilai. Unduh .ipynb tetap tersedia sebagai opsi.",
    href: "/mock",
  },
  {
    id: "kaggle-notebook-competitions",
    at: "2026-08-10T13:00:00+07:00",
    tag: "Simulasi",
    title: "Mode Kaggle clone + referensi IOAI di semua fase",
    story:
      "Generate simulasi Kaggle kini 3 kompetisi / 150 menit: unduh starter .ipynb dan CSV, kerjakan lokal, lalu Submit untuk skor proporsional (accuracy, F1, RMSE). Referensi IOAI sekarang tampil di Belajar/Latihan untuk pre-seleksi, semifinal, dan final. Fase semifinal/final tidak lagi memaksa layar penuh browser.",
    href: "/mock/generate",
  },
  {
    id: "fix-study-practice-pages",
    at: "2026-08-10T11:30:00+07:00",
    tag: "Belajar",
    title: "Perbaikan halaman Belajar & Latihan",
    story:
      "Halaman Belajar dan Latihan kembali normal — perbaikan bundle client yang sempat memuat modul database. Migrasi Postgres untuk kolom user_type juga ditambahkan agar tier akun (gratis/VIP) stabil di produksi.",
    href: "/study",
  },
  {
    id: "ioai-resources-kb",
    at: "2026-08-10T10:10:00+07:00",
    tag: "Belajar",
    title: "Referensi IOAI & knowledge base admin",
    story:
      "Siswa fase semifinal/final melihat tautan Education Hub di Belajar dan Latihan; generate soal AI memakai inspirasi gaya kompetisi internasional. Admin bisa kelola katalog live di Referensi IOAI tanpa redeploy.",
    href: "/study",
  },
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
    href: "/mock/generate",
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

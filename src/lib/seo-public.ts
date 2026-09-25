/** Public FAQ facts for crawlable homepage + llms.txt / JSON-LD (GEO). */
export const PUBLIC_FAQS = [
  {
    question: "Apakah Simulasi OSN AI gratis?",
    answer:
      "Ya. Simulasi OSN AI 100% gratis untuk pelajar Indonesia: harga daftar Rp0, tanpa langganan berbayar untuk materi, bank soal, simulasi berwaktu, dan pelacak performa.",
  },
  {
    question: "Untuk siapa platform ini?",
    answer:
      "Untuk siswa SMA/MA/SMK sederajat di Indonesia yang mempersiapkan Ekshibisi Kompetisi Kecerdasan Artifisial (EKKA) dan Olimpiade Sains Nasional bidang AI (OSN AI) 2026.",
  },
  {
    question: "Apa yang diujikan di EKKA / OSN AI 2026?",
    answer:
      "Menurut panduan EKKA 2026 yang diliput media pendidikan, silabus mencakup lima area: dasar matematika–statistika–Python, machine learning klasik, jaringan saraf tiruan, computer vision, dan NLP. Silabus merupakan subset IOAI; referensi lengkap tersedia di ioai.toki.id.",
  },
  {
    question: "Apa yang bisa dipelajari di Simulasi OSN AI?",
    answer:
      "Empat jalur inti setelah akun gratis: materi silabus, bank soal latihan, simulasi berwaktu mirip format seleksi, dan pelacak mastery — plus tutor AI.",
  },
  {
    question: "Bagaimana cara mulai?",
    answer:
      "1) Buka halaman daftar. 2) Buat akun gratis. 3) Lanjut ke Belajar dan Simulasi. Beranda publik bisa dibaca tanpa login.",
  },
] as const;

export const SITE_URL_FALLBACK = "https://radr.nxtdev.xyz/simosnai";

/** Honest, citable facts for answer-first GEO copy (no invented traffic stats). */
export const PUBLIC_FACTS = {
  priceIdr: 0,
  syllabusAreas: 5,
  featureTracks: 4,
  competitionYear: 2026,
  finalistsEkka: 30,
  region: "Indonesia",
  syllabusSourceName: "IOAI Indonesia (TOKI)",
  syllabusSourceUrl: "https://ioai.toki.id/",
  pressSourceName: "Kompas Edu",
  pressSourceUrl:
    "https://www.kompas.com/edu/read/2026/06/24/080000271/pendaftaran-osn-bidang-ai-2026-dibuka-cek-syarat-dan-materinya",
} as const;

export function publicSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? SITE_URL_FALLBACK
  );
}

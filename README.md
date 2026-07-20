# Simulasi OSN AI 2026

Platform latihan **EKKA / OSN AI** untuk siswa SMA/SMK: materi silabus, latihan soal, simulasi berwaktu, pelacak performa, dan tutor AI (BYOK OpenAI-compatible).

## Fitur

- Akun email/password (Better Auth)
- Modul belajar track A–D (fokus ML & neural nets)
- Bank soal curated (~37) + generate soal AI
- 2 simulasi realistis: 40 soal, 2 jam, semua soal dalam satu halaman
- Laporan skor per track/topik, akurasi, gap, dan waktu pengerjaan
- Dashboard mastery & gap rekomendasi
- Review chat AI scoped ke soal
- Pengaturan API key terenkripsi (AES-GCM)
- Admin login, CRUD pengguna, dan laporan belajar detail
- LLM bersama dari admin dengan BYOK siswa sebagai prioritas

## Stack

Next.js · Tailwind · Drizzle · PostgreSQL/PGlite · Better Auth · AI SDK · KaTeX · Pyodide · Recharts

## Lokal (tanpa Docker)

Default memakai **PGlite** (Postgres embedded) agar bisa langsung jalan:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Buka http://localhost:3000 — daftar akun, lalu mulai latihan.

Admin lokal otomatis dibuat dari `.env.local`:

- URL: http://localhost:3000/admin/login
- Email: `admin@osnai.local`
- Password: `admin12345`

Ganti kredensial tersebut sebelum aplikasi dapat diakses publik.

## Lokal / server dengan Postgres Docker

```bash
# set di .env.local:
# USE_PGLITE=false
# DATABASE_URL=postgresql://osnai:osnai@localhost:5432/osnai

docker compose up -d db
npm run db:push
npm run dev
```

## Deploy Docker penuh

```bash
export USE_PGLITE=false
export DATABASE_URL=postgresql://osnai:osnai@db:5432/osnai
export BETTER_AUTH_SECRET='long-random-secret'
export CREDENTIALS_ENCRYPTION_KEY='64-hex-chars...'
export BETTER_AUTH_URL='https://your.domain'
export NEXT_PUBLIC_APP_URL='https://your.domain'
export ADMIN_EMAIL='admin@your.domain'
export ADMIN_PASSWORD='use-a-strong-unique-password'
export ADMIN_EMAILS='admin@your.domain'
export MINIMAX_API_KEY='your-minimax-api-key'
docker compose up -d --build
```

Atau Vercel + managed Postgres dengan env yang sama (`USE_PGLITE=false`).

## Catatan AI

- Default LLM untuk semua pengguna: **MiniMax M3** — cukup set `MINIMAX_API_KEY` di env (opsional: `MINIMAX_BASE_URL`, `MINIMAX_MODEL_ID`)
- Admin dapat menyediakan base URL + model + API key bersama (mengalahkan default env)
- Siswa dapat memakai AI admin/default atau memasang BYOK; BYOK selalu diprioritaskan
- Key hanya disimpan terenkripsi di DB
- Generate & chat tersedia setelah konfigurasi diuji
- Tutor AI tidak dipakai selama mock aktif (hanya di halaman review setelah submit)

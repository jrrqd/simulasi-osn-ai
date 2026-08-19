# Simulasi OSN AI 2026

Platform latihan **EKKA / OSN AI** untuk siswa SMA/SMK: materi silabus, latihan soal, simulasi berwaktu, pelacak performa, dan tutor AI (BYOK OpenAI-compatible).

Repo: [jrrqd/simulasi-osn-ai](https://github.com/jrrqd/simulasi-osn-ai)

## Fitur

### Siswa

- **Akun** — registrasi & login email/password (Better Auth)
- **Onboarding & profil** — data sekolah, kelas, kota; fase kompetisi (pre-seleksi / semifinal / final)
- **Belajar** (`/study`) — modul pelajaran track A–D (fokus ML & neural networks), progress per bab, AI study assistant + mascot FAB (Jacky/Ichi)
- **Latihan** (`/practice`) — bank soal curated + generate soal AI; numeric, MCQ, Python output, dan coding `codeSpec`
- **Simulasi** (`/mock`) — ujian berwaktu satu halaman, autosave, integritas tab, penalty ICPC opsional, laporan skor lengkap
- **Performa** (`/performance`) — mastery per topik, gap rekomendasi, tren sesi, riwayat latihan & simulasi, AI performance assistant
- **Review** (`/review/[id]`) — pembahasan soal + tutor AI scoped ke soal (setelah submit / di luar mock aktif)
- **Pengaturan** (`/settings`) — BYOK API key terenkripsi (AES-GCM), pilih mascot asisten

### Admin

- Login terpisah (`/admin/login`)
- CRUD pengguna, ban, laporan belajar per siswa
- Bank soal curated + generate AI
- Bank simulasi (curated, assembled, AI-generated)
- Modul pelajaran & countdown fase seleksi
- Konfigurasi LLM bersama (base URL, model, API key)
- Admin assistant (chat kontekstual halaman admin)

## Stack

| Lapisan | Teknologi |
|---------|-----------|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS 4 |
| Database | Drizzle ORM · PostgreSQL atau PGlite (embedded) |
| Auth | Better Auth |
| AI | Vercel AI SDK + MiniMax M3 (OpenAI-compatible) |
| Math | KaTeX (remark/rehype) |
| Python di browser | Pyodide (`PythonRunner`) |
| Coding grader | Judge0 (server-side, hidden test cases) |
| Charts | Recharts |

## Struktur proyek

```
src/
├── app/
│   ├── (app)/          # Shell siswa: study, practice, mock, performance, …
│   ├── (admin)/        # Panel admin
│   ├── (auth)/         # login, register, admin login
│   └── api/            # Route handlers (REST)
├── components/         # UI React
├── db/                 # Drizzle schema & getDb()
├── hooks/              # Client hooks (mis. use-exam-integrity)
└── lib/
    ├── ai/             # Generate soal, chat, provider, parse JSON
    ├── analytics/      # Mastery, readiness, performance context
    ├── content/        # Bank soal & mock (curated + shared loaders)
    ├── exam/           # Penalty ICPC, integritas
    ├── grading/        # Judge0 client
    ├── mocks/          # Scoring simulasi
    └── scoring/        # Penilaian jawaban per tipe
docs/
└── mock-exam.md        # Dokumentasi detail simulasi berwaktu
scripts/
└── deploy.sh           # Deploy ke VPS produksi
```

## Mulai cepat (lokal)

Default memakai **PGlite** (Postgres embedded) — tidak perlu Docker untuk development:

```bash
cp .env.example .env.local
# Isi minimal: BETTER_AUTH_SECRET, CREDENTIALS_ENCRYPTION_KEY
# Generate key: openssl rand -hex 32

npm install
npm run dev
```

Buka http://localhost:3000 — daftar akun siswa, lalu mulai belajar.

Admin lokal dibuat otomatis dari `ADMIN_EMAIL` / `ADMIN_PASSWORD` di `.env.local`. Buka http://localhost:3000/admin/login.

> **PGlite in-memory:** data (termasuk admin & user terdaftar) hilang saat dev server restart kecuali Anda set `PGLITE_DATA_DIR=.data/pglite` untuk persistensi.

### Perintah npm

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Jalankan build |
| `npm run lint` | ESLint |
| `npm test` | Unit test (`src/**/*.test.ts`) |
| `npm run db:push` | Push schema ke Postgres (bukan PGlite) |
| `npm run db:studio` | Drizzle Studio |

Verifikasi sebelum merge/deploy:

```bash
npx tsc --noEmit
npm run lint
npm test
```

## Variabel lingkungan

Salin `.env.example` → `.env.local`. Ringkasan:

| Variabel | Wajib | Keterangan |
|----------|-------|------------|
| `USE_PGLITE` | ✓ (dev) | `true` = embedded DB; `false` + `DATABASE_URL` untuk Postgres |
| `BETTER_AUTH_SECRET` | ✓ | Secret session auth |
| `CREDENTIALS_ENCRYPTION_KEY` | ✓ | 64 hex chars (`openssl rand -hex 32`) untuk enkripsi BYOK |
| `BETTER_AUTH_URL` | ✓ | URL publik app (mis. `http://localhost:3000`) |
| `NEXT_PUBLIC_APP_URL` | ✓ | Sama, untuk link client |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ✓ | Seed admin pertama; admin lain dipromosikan lewat Admin → Users |
| `AUTH_INSECURE_COOKIES` | opsional | `true` hanya untuk akses HTTP lokal/Tailscale (cookie non-Secure) |
| `AI_PROVIDER_HOST_ALLOWLIST` | opsional | Host provider AI tambahan di luar allowlist bawaan |
| `MINIMAX_API_KEY` | opsional | Default LLM untuk semua fitur AI |
| `MINIMAX_BASE_URL` / `MINIMAX_MODEL_ID` | opsional | Override endpoint/model |
| `JUDGE0_BASE_URL` | coding | Wajib untuk penilaian `codeSpec` di latihan & simulasi |
| `JUDGE0_LANGUAGE_ID` | opsional | Default Python 3 = `71` |
| `JUDGE0_API_KEY` / `JUDGE0_API_HOST` | opsional | Untuk RapidAPI Judge0 |
| `FIGURES_DIR` | opsional | Penyimpanan gambar soal (default `.data/figures`) |
| `PGLITE_DATA_DIR` | opsional | Persistensi PGlite lokal |

Prioritas provider AI: **BYOK siswa** > **admin shared** > **MINIMAX env default**.

## Database

Schema Drizzle di `src/db/schema.ts`. Tabel utama:

- `user`, `session`, `account` — auth & profil
- `attempts` — riwayat jawaban latihan & mock
- `mock_sessions` — sesi simulasi (`in_progress` / `submitted`), jawaban, skor, integritas, penalty
- `submission_events` — log submit per-soal (penalty ICPC)
- `lesson_progress`, `ai_credentials`, `admin_ai_settings`, …

PGlite self-migrate pada `getDb()` pertama — tidak perlu `db:push` di dev embedded.

### Postgres (Docker / produksi)

```bash
# .env.local
USE_PGLITE=false
DATABASE_URL=postgresql://osnai:osnai@localhost:5432/osnai

docker compose up -d db
npm run db:push
npm run dev
```

## Rute aplikasi

### Siswa (auth required kecuali landing)

| Rute | Deskripsi |
|------|-----------|
| `/` | Landing + countdown seleksi |
| `/study`, `/study/[id]` | Modul belajar |
| `/practice`, `/practice/[id]` | Latihan soal |
| `/mock`, `/mock/[id]` | Daftar & kerjakan simulasi |
| `/performance` | Dashboard performa |
| `/review/[id]` | Review + tutor AI |
| `/settings` | BYOK & preferensi |
| `/onboarding` | Onboarding siswa baru |

### Admin

| Rute | Deskripsi |
|------|-----------|
| `/admin` | Dashboard |
| `/admin/users`, `/admin/users/[id]` | Manajemen & laporan siswa |
| `/admin/problems` | Bank soal |
| `/admin/mocks` | Bank simulasi |
| `/admin/lessons` | Modul pelajaran |
| `/admin/ai` | Pengaturan LLM bersama |
| `/admin/countdown` | Fase countdown seleksi |

### API (cuplikan)

| Endpoint | Fungsi |
|----------|--------|
| `POST /api/mocks` | Mulai / lanjutkan simulasi |
| `PUT /api/mocks` | Kumpulkan simulasi |
| `POST /api/attempts` | Submit latihan |
| `POST /api/code/grade` | Grade coding (hidden tests) |
| `POST /api/ai/generate` | Generate soal |
| `POST /api/ai/generate-mock` | Generate paket simulasi AI |
| `POST /api/ai/*-assistant` | Chat asisten (study, practice, performance) |

## Tipe soal & penilaian

| `answerType` | Input siswa | Penilaian |
|--------------|-------------|-----------|
| `numeric` | Angka / pecahan (`1/2`, `½`, `0,5`) | Toleransi & format |
| `short_string` | Teks singkat | Normalisasi string |
| `multi_part` | Beberapa bagian | Per bagian |
| `mcq` | Pilihan ganda | Exact match |
| `python_output` | Output Pyodide | Bandingkan output |
| `codeSpec` | Skeleton + WRITE HERE | Judge0, test case tersembunyi |

Bobot simulasi OSN AI 2026: isian singkat = 1 poin, coding = 2 poin (dinormalisasi ke persentase). Detail simulasi: [`docs/mock-exam.md`](docs/mock-exam.md).

## AI & generate soal

- Default model: **MiniMax M3** via `MINIMAX_API_KEY`
- Generate soal memakai plain JSON + perbaikan lokal (`src/lib/ai/parse-json-object.ts`) — MiniMax tidak andal dengan JSON schema terstruktur
- Generate simulasi AI: `src/app/api/ai/generate-mock/route.ts`
- Tutor AI **dinonaktifkan** selama mock aktif; tersedia di `/review/[id]` setelah submit
- Gambar geometri (opsional): MiniMax image model + `FIGURES_DIR`

## Simulasi berwaktu

Ringkasan:

1. Semua soal dalam satu halaman, timer, autosave
2. Layar penuh diminta saat mulai (best-effort)
3. Konfirmasi **Akhiri ujian** memakai modal in-app (bukan `window.confirm`)
4. Setelah submit: keluar layar penuh → laporan nilai → **Kembali ke simulasi**
5. Soft proctoring: hanya meninggalkan tab ≥1,5 detik yang dihitung

Dokumentasi lengkap: **[`docs/mock-exam.md`](docs/mock-exam.md)**

## Deploy

### Docker Compose (app + Postgres)

```bash
export POSTGRES_PASSWORD='use-a-strong-db-password'
export BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
export CREDENTIALS_ENCRYPTION_KEY="$(openssl rand -hex 32)"
export BETTER_AUTH_URL='https://your.domain'
export NEXT_PUBLIC_APP_URL='https://your.domain'
export ADMIN_EMAIL='admin@your.domain'
export ADMIN_PASSWORD='use-a-strong-unique-password'
export MINIMAX_API_KEY='your-minimax-api-key'

docker compose up -d --build
```

Atau Vercel + managed Postgres dengan env yang sama (`USE_PGLITE=false`).

### VPS produksi

```bash
./scripts/deploy.sh
# atau: REMOTE=ubuntu@host ./scripts/deploy.sh
```

Alur: rsync → `npm ci && npm run build` di `/opt/osnai-build` → promote standalone ke `/var/www/osnai` → `systemctl restart osnai`.

Env produksi: `/etc/osnai/env` pada VPS.

> Jangan pakai password contoh di produksi. Ganti semua secret sebelum deploy publik.

## Dokumentasi tambahan

| File | Isi |
|------|-----|
| [`docs/mock-exam.md`](docs/mock-exam.md) | Alur simulasi, fullscreen, integritas, API |
| [`AGENTS.md`](AGENTS.md) | Panduan untuk AI coding agents & Cursor Cloud |
| [`.env.example`](.env.example) | Template variabel lingkungan |

## Lisensi

Proyek privat (`"private": true` di `package.json`).

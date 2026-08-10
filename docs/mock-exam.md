# Simulasi berwaktu (mock exam)

Dokumentasi alur ujian simulasi di `/mock/[id]`: UI siswa, pengumpulan jawaban, integritas, dan perilaku layar penuh.

## Ringkasan alur

1. Siswa membuka paket simulasi dari `/mock`.
2. Di halaman pre-start, siswa membaca aturan lalu menekan **Mulai simulasi**.
3. Server membuat atau melanjutkan sesi `in_progress` (`POST /api/mocks`).
4. UI meminta layar penuh (best-effort) dan menampilkan semua soal dalam satu halaman.
5. Jawaban disimpan otomatis (`PATCH /api/mocks` dengan debounce).
6. Siswa mengakhiri ujian lewat **Akhiri ujian** atau timer habis.
7. Server menilai dan menandai sesi `submitted` (`PUT /api/mocks`).
8. UI keluar dari layar penuh dan menampilkan **Laporan penilaian**.

## File utama

| File | Peran |
|------|-------|
| `src/app/(app)/mock/[id]/page.tsx` | Server page: resolve mock + soal |
| `src/components/mock-exam-client.tsx` | UI ujian, submit, laporan nilai |
| `src/hooks/use-exam-integrity.ts` | Layar penuh + pemantauan integritas |
| `src/lib/exam-integrity.ts` | Konstanta & merge state integritas |
| `src/app/api/mocks/route.ts` | API start / autosave / submit |
| `src/lib/mocks/scoring.ts` | Penilaian akhir mock |

## Layar penuh (fullscreen)

Saat **Mulai simulasi**, klien memanggil `document.documentElement.requestFullscreen()` dari gesture klik pengguna. Ini bersifat best-effort: browser dapat menolak jika kebijakan tidak mengizinkan.

Setelah ujian berhasil dikumpulkan, klien memanggil `document.exitFullscreen()` agar siswa kembali ke tampilan browser normal (header situs, navigasi, dll.).

### Catatan implementasi

- Jangan memakai `window.confirm()` selama ujian berjalan di layar penuh. Dialog native sering diblokir atau dianggap dibatalkan, sehingga tombol **Akhiri ujian** tampak tidak bereaksi.
- Konfirmasi akhir ujian memakai modal in-app (`submitConfirmOpen` di `mock-exam-client.tsx`) yang tetap terlihat di mode layar penuh.
- Keluar layar penuh dengan tombol Esc **tidak** dihitung sebagai pelanggaran integritas.

## Mengakhiri ujian

### Manual — **Akhiri ujian**

1. Siswa menekan **Akhiri ujian** (header atau bawah halaman).
2. Modal konfirmasi in-app muncul.
   - Jika masih ada soal kosong, pesan memperingatkan jumlah soal yang belum dijawab.
3. Setelah konfirmasi, klien mengirim `PUT /api/mocks` dengan `sessionId` dan `answers`.
4. Jika sukses: keluar layar penuh → tampilkan `ScoringReport`.
5. Jika gagal: pesan error ditampilkan; siswa tetap di sesi ujian.

### Otomatis

- **Timer habis:** `Countdown` memanggil `submitExam(true)` tanpa modal konfirmasi.
- **Integritas:** setelah `INTEGRITY_FORCE_SUBMIT_AT` pelanggaran, ujian dikumpulkan paksa dengan `integrityForcedSubmit: true`.

### Laporan nilai

Setelah submit, komponen `ScoringReport` menampilkan:

- Skor berbobot, persentase, benar/salah/kosong, waktu
- Breakdown per track, topik, dan per soal
- Tombol **Kembali ke simulasi** → `/mock`
- Link **Review solusi + Tutor AI** per soal → `/review/[id]`

## Pemantauan integritas

Kebijakan "soft proctoring" — hanya **meninggalkan tab** (Page Visibility `hidden` ≥ 1,5 detik) yang dihitung.

| Konstanta | Nilai | Efek |
|-----------|-------|------|
| `INTEGRITY_AWAY_MS` | 1500 ms | Durasi minimum dianggap "pergi" |
| `INTEGRITY_FLAG_AT` | 3 | Sesi ditandai untuk tinjauan admin |
| `INTEGRITY_FORCE_SUBMIT_AT` | 5 | Ujian dikumpulkan otomatis |

**Diperbolehkan (tidak dihitung):**

- Kehilangan fokus dalam tab yang sama
- Menghitung di kertas / idle di tab ujian
- Keluar dari layar penuh dengan Esc

Saat siswa kembali setelah pelanggaran, overlay **Kembali ke ujian** muncul. Ini hanya untuk melanjutkan ujian, bukan untuk mengakhiri.

## API mock (`/api/mocks`)

| Method | Tujuan |
|--------|--------|
| `GET` | Daftar mock |
| `POST` | Mulai / lanjutkan sesi (`mockId`) |
| `PATCH` | Autosave jawaban, update integritas, submit per-soal (penalty ICPC) |
| `PUT` | Kumpulkan ujian & nilai akhir |

Sesi disimpan di tabel `mockSessions` dengan status `in_progress` atau `submitted`.

## Penilaian coding (`codeSpec`)

Soal coding dinilai di server saat submit akhir (dan saat submit per-soal jika penalty aktif), memakai Judge0. Klien **tidak** boleh dipercaya untuk hasil test case.

Env terkait: lihat `.env.example` (`JUDGE0_*`). Jika grader belum dikonfigurasi, `PUT /api/mocks` mengembalikan `503` untuk mock yang berisi soal `codeSpec`.

## Pengujian manual

1. Buka `/mock/[id]`, mulai simulasi, terima layar penuh jika browser mengizinkan.
2. Klik **Akhiri ujian** → pastikan modal konfirmasi muncul (bukan dialog browser native).
3. Konfirmasi → pastikan layar penuh keluar dan laporan nilai tampil.
4. Klik **Kembali ke simulasi** → kembali ke `/mock`.
5. Ulangi dengan timer habis dan dengan pelanggaran integritas (opsional).

## Deploy

Perubahan pada alur ujian memerlukan deploy frontend:

```bash
./scripts/deploy.sh
```

Lihat `AGENTS.md` untuk detail VPS (`ubuntu@43.134.182.44`, unit `osnai.service`).

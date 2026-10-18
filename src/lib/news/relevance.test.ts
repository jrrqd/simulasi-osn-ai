import assert from "node:assert/strict";
import test from "node:test";
import { isRelevantOlympiadNews } from "@/lib/news/relevance";

test("ekka: keeps real EKKA / OSN AI headlines", () => {
  assert.equal(
    isRelevantOlympiadNews(
      "Kemendikdasmen Umumkan Pemenang EKKA OSN Jenjang Pendidikan Menengah 2026",
      "",
      "ekka",
    ),
    true,
  );
  assert.equal(
    isRelevantOlympiadNews(
      "Kemendikdasmen Hadirkan Ekshibisi Kompetisi Kecerdasan Artifisial pada LKS dan OSN",
      "",
      "ekka",
    ),
    true,
  );
  assert.equal(
    isRelevantOlympiadNews(
      "566 Finalis Ikuti OSN Dikmen-EKKA 2026, Berebut Tiket ke Internasional",
      "",
      "ekka",
    ),
    true,
  );
});

test("ekka: drops unrelated regional / lifestyle hits", () => {
  assert.equal(
    isRelevantOlympiadNews(
      "Usai Disomasi, Kuasa Hukum Radar Sulteng Klarifikasi Belum Ada Kesepakatan dengan Dekan FKM Untad",
      "Usai Disomasi, Kuasa Hukum Radar Sulteng Klarifikasi Belum Ada Kesepakatan dengan Dekan FKM Untad KABAR68.com",
      "ekka",
    ),
    false,
  );
  assert.equal(
    isRelevantOlympiadNews(
      "Dekan FKM Untad Rosmala Nur Disomasi",
      "",
      "ekka",
    ),
    false,
  );
  assert.equal(
    isRelevantOlympiadNews(
      "7 Film India Selatan Terbaru Siap Beredar Minggu Ini: dari Gevi, Bun Butter Jam hingga Ekka",
      "",
      "ekka",
    ),
    false,
  );
  assert.equal(
    isRelevantOlympiadNews(
      "Wanita yang Dilabrak Istri Sah di Mie Gacoan Kendari Angkat Bicara",
      "",
      "ekka",
    ),
    false,
  );
});

test("non-strict keywords pass through", () => {
  assert.equal(
    isRelevantOlympiadNews("Any headline", "", "osn ai"),
    true,
  );
});

test("toki: keeps Indonesian computer olympiad coverage", () => {
  assert.equal(
    isRelevantOlympiadNews(
      "TOKI Siapkan Tim Olimpiade Komputer Indonesia untuk IOAI 2026",
      "",
      "toki",
    ),
    true,
  );
  assert.equal(
    isRelevantOlympiadNews(
      "Pelatnas OSN Informatika dibina TOKI",
      "Seleksi nasional komputer",
      "toki",
    ),
    true,
  );
  assert.equal(
    isRelevantOlympiadNews(
      "Info lomba di portal toki.id",
      "",
      "toki",
    ),
    true,
  );
});

test("toki: drops unrelated foreign / homonym hits", () => {
  assert.equal(
    isRelevantOlympiadNews(
      "Toki cần được bảo vệ tại công viên ở Hà Nội",
      "Vietnam wildlife",
      "toki",
    ),
    false,
  );
  assert.equal(
    isRelevantOlympiadNews(
      "Tokyo zoo celebrates rare toki bird hatch",
      "Japan nature news",
      "toki",
    ),
    false,
  );
  assert.equal(
    isRelevantOlympiadNews(
      "Toki fashion week opens in Seoul",
      "",
      "toki",
    ),
    false,
  );
});

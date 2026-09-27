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

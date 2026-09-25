import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/session";
import {
  listLatestNews,
  listPreviousNews,
  NEWS_LIST_LIMIT,
  type NewsItemRow,
} from "@/lib/news-feed";
import { publicSiteUrl } from "@/lib/seo-public";
import { formatDateTimeWib } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Berita EKKA dan OSN AI",
  description:
    "Cuplikan berita pendidikan tentang EKKA, OSN AI, OSN Informatika, dan IOAI. Rangkuman singkat dengan tautan ke sumber asli.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Berita EKKA dan OSN AI 2026",
    description:
      "Ringkasan berita relevan untuk persiapan seleksi — baca lengkap di penerbit asal.",
  },
};

const SITE_URL = publicSiteUrl();

function formatPublished(at: Date | null, fetchedAt: Date): string {
  const d = at ?? fetchedAt;
  return formatDateTimeWib(d.toISOString(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function NewsCard({
  item,
  compact = false,
}: {
  item: NewsItemRow;
  compact?: boolean;
}) {
  return (
    <li
      className={
        compact
          ? "border-b border-[var(--line)] py-4 last:border-b-0"
          : "rounded-2xl border border-[var(--line)] bg-[rgba(255,252,246,0.7)] p-5"
      }
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {item.sourceName} · {formatPublished(item.publishedAt, item.fetchedAt)}{" "}
        · {item.keyword}
      </p>
      <h2
        className={
          compact
            ? "mt-1.5 text-base font-semibold leading-snug text-[var(--ink)]"
            : "mt-2 text-lg font-semibold leading-snug text-[var(--ink)]"
        }
      >
        {item.title}
      </h2>
      {!compact ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {item.summary}
        </p>
      ) : null}
      <a
        href={item.canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={
          compact
            ? "mt-2 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline"
            : "mt-4 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline"
        }
      >
        Baca di sumber →
      </a>
    </li>
  );
}

export default async function BeritaPage() {
  const [session, items, previous] = await Promise.all([
    getSession(),
    listLatestNews(NEWS_LIST_LIMIT),
    listPreviousNews({ offset: NEWS_LIST_LIMIT }),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/berita#webpage`,
        url: `${SITE_URL}/berita`,
        name: "Berita EKKA dan OSN AI 2026",
        description:
          "Cuplikan dan rangkuman berita tentang EKKA, OSN AI, OSN Informatika, dan IOAI, dengan tautan ke sumber asli.",
        inLanguage: "id",
        isAccessibleForFree: true,
        dateModified: new Date().toISOString(),
      },
      {
        "@type": "ItemList",
        "@id": `${SITE_URL}/berita#list`,
        name: "Berita terkini EKKA / OSN AI",
        numberOfItems: items.length,
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: item.canonicalUrl,
          name: item.title,
        })),
      },
      ...(previous.length > 0
        ? [
            {
              "@type": "ItemList",
              "@id": `${SITE_URL}/berita#previous`,
              name: "Berita sebelumnya EKKA / OSN AI",
              numberOfItems: previous.length,
              itemListElement: previous.map((item, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: item.canonicalUrl,
                name: item.title,
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader
        userName={session?.user?.name}
        userRole={session?.user?.role}
      />
      <main className="mx-auto max-w-3xl px-4 py-12 md:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
          Berita
        </p>
        <h1 className="display mt-2 text-3xl md:text-4xl">
          Berita EKKA dan OSN AI 2026
        </h1>
        <p className="mt-4 text-[var(--muted)]">
          Halaman ini merangkum cuplikan berita pendidikan terkait seleksi EKKA,
          OSN AI, OSN Informatika, dan IOAI. Isi lengkap tetap di situs penerbit
          — kami tidak menyalin artikel. Saat berita baru masuk, cuplikan lama
          pindah ke bagian Berita sebelumnya.
        </p>

        {items.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-[var(--line)] bg-[rgba(255,252,246,0.6)] p-6 text-sm text-[var(--muted)]">
            Belum ada cuplikan tersimpan. Pembaruan otomatis berjalan setiap hari
            pukul 06.00 WIB.
          </p>
        ) : (
          <ul className="mt-10 space-y-5">
            {items.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </ul>
        )}

        {previous.length > 0 ? (
          <section className="mt-14" aria-labelledby="berita-sebelumnya">
            <h2
              id="berita-sebelumnya"
              className="text-xl font-semibold text-[var(--ink)] md:text-2xl"
            >
              Berita sebelumnya
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Cuplikan yang sudah digeser dari daftar terkini setelah pembaruan
              harian.
            </p>
            <ul className="mt-6 rounded-2xl border border-[var(--line)] bg-[rgba(255,252,246,0.45)] px-5">
              {previous.map((item) => (
                <NewsCard key={item.id} item={item} compact />
              ))}
            </ul>
          </section>
        ) : null}

        <p className="mt-10 text-sm text-[var(--muted)]">
          <Link href="/" className="text-[var(--accent)] underline">
            Kembali ke beranda
          </Link>
        </p>
      </main>
    </div>
  );
}

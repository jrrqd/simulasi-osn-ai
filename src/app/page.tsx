import Link from "next/link";
import { appPath } from "@/lib/app-path";
import { SiteHeader } from "@/components/site-header";
import { EventCountdown } from "@/components/event-countdown";
import { WhatsNewSection } from "@/components/whats-new-section";
import { listPublicCountdownPhases } from "@/lib/countdown-phases";
import { getSession } from "@/lib/session";
import {
  PUBLIC_FACTS,
  PUBLIC_FAQS,
  publicSiteUrl,
} from "@/lib/seo-public";

export const dynamic = "force-dynamic";

const SITE_URL = publicSiteUrl();
const CONTENT_MODIFIED = "2026-09-25T17:30:00+07:00";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Simulasi OSN AI 2026 Gratis",
      description:
        "Gratis untuk pelajar Indonesia. Platform persiapan EKKA/OSN AI 2026 tanpa biaya: materi silabus, bank soal, simulasi berwaktu, pelacak performa, dan tutor AI.",
      inLanguage: "id",
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "RegisterAction",
        target: `${SITE_URL}/register`,
        name: "Daftar gratis",
      },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: `${SITE_URL}/`,
      name: "Simulasi OSN AI 2026 Gratis",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      inLanguage: "id",
      dateModified: CONTENT_MODIFIED,
      isAccessibleForFree: true,
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: `${SITE_URL}/hero-atmosphere.png`,
      },
    },
    {
      "@type": ["WebApplication", "SoftwareApplication"],
      "@id": `${SITE_URL}/#app`,
      name: "Simulasi OSN AI",
      url: SITE_URL,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      inLanguage: "id",
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        name: "Gratis",
        price: String(PUBLIC_FACTS.priceIdr),
        priceCurrency: "IDR",
        description: "Daftar dan pakai tanpa biaya.",
        availability: "https://schema.org/InStock",
      },
      provider: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "EducationalOrganization",
      "@id": `${SITE_URL}/#organization`,
      name: "Simulasi OSN AI",
      url: SITE_URL,
      description:
        "Platform latihan daring gratis untuk seleksi EKKA dan Olimpiade Sains Nasional bidang Kecerdasan Artifisial (OSN AI) 2026.",
      areaServed: {
        "@type": "Country",
        name: PUBLIC_FACTS.region,
      },
      audience: {
        "@type": "EducationalAudience",
        educationalRole: "student",
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      inLanguage: "id",
      mainEntity: PUBLIC_FAQS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ],
};

export default async function HomePage() {
  const [session, phases] = await Promise.all([
    getSession(),
    listPublicCountdownPhases(),
  ]);

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
      <main>
        <section
          className="relative isolate min-h-[78vh] overflow-hidden bg-cover bg-center"
          style={{ backgroundImage: `url('${appPath("/hero-atmosphere.png")}')` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(243,239,230,0.94)_0%,rgba(243,239,230,0.78)_42%,rgba(243,239,230,0.28)_100%)]" />
          <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-4 py-14">
            <div className="rise max-w-2xl space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                Gratis · EKKA · OSN AI {PUBLIC_FACTS.competitionYear}
              </p>
              <h1 className="display text-5xl leading-tight md:text-6xl">
                Simulasi OSN AI gratis {PUBLIC_FACTS.competitionYear}
              </h1>
              <p className="max-w-xl text-lg text-[var(--muted)]">
                Jawaban singkat: Simulasi OSN AI adalah platform persiapan EKKA /
                OSN AI {PUBLIC_FACTS.competitionYear} untuk pelajar Indonesia
                dengan harga Rp{PUBLIC_FACTS.priceIdr} — materi, bank soal,
                simulasi berwaktu, dan pelacak performa tanpa biaya.
              </p>

              <EventCountdown phases={phases} />

              <div className="flex flex-wrap gap-3">
                <Link
                  href={session ? "/study" : "/register"}
                  className="btn btn-primary"
                >
                  {session ? "Lanjut belajar" : "Mulai gratis"}
                </Link>
                <Link href="/mock" className="btn btn-secondary">
                  Lihat simulasi
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--line)] bg-[rgba(255,252,246,0.45)]">
          <div className="mx-auto max-w-6xl space-y-4 px-4 py-12 md:py-14">
            <h2 className="display text-2xl md:text-3xl">
              Apa itu Simulasi OSN AI?
            </h2>
            <p className="max-w-3xl text-[var(--muted)]">
              Simulasi OSN AI adalah platform daring gratis untuk siswa
              SMA/MA/SMK di {PUBLIC_FACTS.region} yang mempersiapkan seleksi
              EKKA dan OSN AI {PUBLIC_FACTS.competitionYear}. Empat jalur
              latihan utama (materi, soal, simulasi, performa) terbuka setelah
              membuat akun — tanpa biaya daftar atau langganan.
            </p>
            <p className="max-w-3xl text-sm text-[var(--muted)]">
              Konteks kompetisi: EKKA {PUBLIC_FACTS.competitionYear} menjaring
              hingga {PUBLIC_FACTS.finalistsEkka} finalis menuju babak final
              nasional, dengan silabus{" "}
              {PUBLIC_FACTS.syllabusAreas} area (dasar Python &amp; statistika,
              ML klasik, JST, computer vision, NLP) yang merupakan subset IOAI.
              Ringkasan silabus resmi IOAI Indonesia:{" "}
              <a
                href={PUBLIC_FACTS.syllabusSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] underline"
              >
                {PUBLIC_FACTS.syllabusSourceName}
              </a>
              . Liputan syarat dan materi EKKA:{" "}
              <a
                href={PUBLIC_FACTS.pressSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] underline"
              >
                {PUBLIC_FACTS.pressSourceName}
              </a>
              .
            </p>
            <ul className="grid max-w-3xl gap-3 text-[var(--muted)] sm:grid-cols-2">
              <li>
                <strong className="text-[var(--ink)]">Materi silabus</strong> —
                ringkasan topik sesuai silabus OSN AI{" "}
                {PUBLIC_FACTS.competitionYear}.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Latihan soal</strong> —
                bank soal dengan umpan balik dan tutor AI.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Simulasi berwaktu</strong> —
                tryout mirip format seleksi.
              </li>
              <li>
                <strong className="text-[var(--ink)]">Performa</strong> —
                pelacak mastery dan riwayat sesi belajar.
              </li>
            </ul>
            <p className="pt-2">
              <Link
                href="/berita"
                className="text-sm font-semibold text-[var(--accent)] underline"
              >
                Lihat berita EKKA &amp; OSN AI →
              </Link>
            </p>
          </div>
        </section>

        <section
          id="faq"
          className="border-t border-[var(--line)]"
          aria-labelledby="faq-heading"
        >
          <div className="mx-auto max-w-6xl space-y-6 px-4 py-12 md:py-14">
            <div className="max-w-2xl space-y-2">
              <h2 id="faq-heading" className="display text-2xl md:text-3xl">
                Pertanyaan umum
              </h2>
              <p className="text-[var(--muted)]">
                Jawaban langsung (answer-first) untuk mesin pencari dan asisten
                AI.
              </p>
            </div>
            <dl className="mx-auto max-w-3xl space-y-5">
              {PUBLIC_FAQS.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-[var(--ink)]">
                    {item.question}
                  </dt>
                  <dd className="mt-1.5 text-[var(--muted)]">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <WhatsNewSection />
      </main>
    </div>
  );
}

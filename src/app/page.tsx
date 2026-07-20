import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { EventCountdown } from "@/components/event-countdown";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();

  return (
    <div>
      <SiteHeader
        userName={session?.user?.name}
        userRole={session?.user?.role}
      />
      <main>
        <section
          className="relative isolate min-h-[78vh] overflow-hidden bg-cover bg-center"
          style={{ backgroundImage: "url('/hero-atmosphere.png')" }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(243,239,230,0.94)_0%,rgba(243,239,230,0.78)_42%,rgba(243,239,230,0.28)_100%)]" />
          <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-4 py-14">
            <div className="rise max-w-2xl space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                EKKA · OSN AI 2026
              </p>
              <h1 className="display text-5xl leading-tight md:text-6xl">
                Simulasi OSN AI
              </h1>
              <p className="max-w-xl text-lg text-[var(--muted)]">
                Persiapan seleksi dengan materi silabus 2026, bank soal, simulasi
                berwaktu, pelacak performa, dan tantangan AI.
              </p>

              <EventCountdown />

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
      </main>
    </div>
  );
}

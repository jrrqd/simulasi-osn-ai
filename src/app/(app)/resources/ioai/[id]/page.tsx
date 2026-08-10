import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { GuideSpoiler } from "@/components/ioai-guide-spoiler";
import { getIoaiGuide } from "@/lib/content/ioai-guides";
import { getIoaiResource } from "@/lib/content/ioai-resources";
import { requireUser } from "@/lib/session";
import {
  canAccessIoaiResources,
  loadUserPhase,
} from "@/lib/user/load-phase";
import { TOPIC_LABELS } from "@/lib/content/types";

export const dynamic = "force-dynamic";

export default async function IoaiGuidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const phase = await loadUserPhase(user.id);
  const isAdmin = user.role === "admin";

  if (!canAccessIoaiResources(phase, user.role)) {
    redirect("/study");
  }

  const guide = await getIoaiGuide(id, { includeHidden: isAdmin });
  if (!guide || (guide.hidden && !isAdmin)) notFound();

  const resource = await getIoaiResource(guide.resourceId);

  return (
    <div className="space-y-6 pb-24">
      <div>
        <Link
          href="/practice"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <ArrowLeft size={14} />
          Kembali
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Panduan belajar IOAI · Bahasa Indonesia
        </p>
        <h1 className="display mt-1 text-4xl">{guide.title}</h1>
        {resource ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{resource.summary}</p>
        ) : null}
        {guide.topics.length > 0 ? (
          <p className="mt-2 flex flex-wrap gap-1.5 text-xs text-[var(--muted)]">
            {guide.topics.map((topic) => (
              <span
                key={topic}
                className="rounded-full bg-black/5 px-2 py-0.5"
              >
                {TOPIC_LABELS[topic] ?? topic}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <section className="panel space-y-3 rounded-3xl p-5">
        <h2 className="display text-2xl">Ringkasan</h2>
        <Markdown content={guide.ringkasan} />
      </section>

      <GuideSpoiler
        title="Kunci jawaban"
        hint="Metrik skor, format I/O, dan checklist — buka setelah mencoba"
      >
        <Markdown content={guide.kunciJawaban} />
      </GuideSpoiler>

      <GuideSpoiler
        title="Pembahasan"
        hint="Ide solusi referensi (bukan full code) — buka setelah mengerjakan"
      >
        <Markdown content={guide.pembahasan} />
      </GuideSpoiler>

      <section className="rounded-2xl border border-[var(--line)] bg-white/40 px-4 py-3 text-sm text-[var(--muted)]">
        <p className="font-medium text-[var(--ink)]">Kredit & lisensi</p>
        <p className="mt-1">{guide.credit}</p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-xs text-[var(--muted)]">
            Tautan resmi IOAI (CC-BY-4.0)
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={guide.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary inline-flex items-center gap-1.5 !py-1.5 text-sm"
            >
              <ExternalLink size={14} />
              Buka soal asli
            </a>
            {guide.solutionUrl ? (
              <a
                href={guide.solutionUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary inline-flex items-center gap-1.5 !py-1.5 text-sm"
              >
                <ExternalLink size={14} />
                Buka solusi resmi
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

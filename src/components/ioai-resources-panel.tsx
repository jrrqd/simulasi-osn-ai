"use client";

import Link from "next/link";
import { ExternalLink, BookOpen } from "lucide-react";
import type { IoaiResourceRecord } from "@/lib/content/resource-types";

const CATEGORY_LABEL: Record<string, string> = {
  syllabus: "Silabus",
  task_repo: "Repo tugas",
  national_olympiad: "Olimpiade",
  course: "Kursus",
};

export function IoaiResourcesPanel({
  resources,
}: {
  resources: IoaiResourceRecord[];
}) {
  if (resources.length === 0) return null;

  return (
    <section className="panel space-y-4 rounded-3xl p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Referensi IOAI
        </p>
        <h2 className="display text-2xl">Materi olimpiade AI</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Tugas resmi IOAI 2025 Individual Contest — baca panduan Bahasa
          Indonesia, lalu buka notebook asli di GitHub.
        </p>
      </div>
      <ul className="space-y-3">
        {resources.map((resource) => (
          <li
            key={resource.id}
            className="flex flex-col gap-3 border-t border-[var(--line)] pt-3 first:border-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {CATEGORY_LABEL[resource.category] ?? resource.category}
                  {resource.year ? ` · ${resource.year}` : ""}
                </span>
                {resource.guideId ? (
                  <span className="rounded-full bg-[var(--accent)]/12 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                    Panduan ID
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 font-medium leading-snug">{resource.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {resource.summary}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {resource.guideId ? (
                <Link
                  href={`/resources/ioai/${resource.guideId}`}
                  className="btn btn-primary inline-flex items-center gap-1.5 !py-1.5 text-sm"
                >
                  <BookOpen size={14} />
                  Baca panduan (ID)
                </Link>
              ) : null}
              <a
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary inline-flex items-center gap-1.5 !py-1.5 text-sm"
              >
                <ExternalLink size={14} />
                {resource.guideId ? "Soal asli" : "Buka"}
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

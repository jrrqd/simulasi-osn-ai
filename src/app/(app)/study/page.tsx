import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getLessons } from "@/lib/content/load";
import { TRACKS } from "@/lib/content/types";

export default async function StudyPage() {
  await requireUser();
  const lessons = getLessons();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl">Belajar</h1>
        <p className="text-[var(--muted)]">
          Modul silabus EKKA 2026 — fokus seleksi, terutama track B & C.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(TRACKS).map(([id, meta]) => (
          <div key={id} className="panel rounded-3xl p-5">
            <h2 className="display text-2xl">
              {id}. {meta.name}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{meta.description}</p>
            <ul className="mt-4 space-y-2">
              {lessons
                .filter((l) => l.track === id)
                .map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/study/${l.id}`}
                      className="text-[var(--accent)] hover:underline"
                    >
                      {l.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

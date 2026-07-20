import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listAllMocks } from "@/lib/content/shared";
import { GenerateMockChallenge } from "@/components/generate-mock-challenge";
import { GenerateCuratedMockChallenge } from "@/components/generate-curated-mock-challenge";
import { labelDifficultyMode, type DifficultyMode } from "@/lib/ai/difficulty";

export default async function MockListPage() {
  await requireUser();
  const mocks = await listAllMocks();
  const official = mocks.filter((m) => m.source === "curated");
  const curatedAssembled = mocks.filter(
    (m) => m.source === "ai" && m.kind === "curated_assembled",
  );
  const aiGenerated = mocks.filter(
    (m) => m.source === "ai" && m.kind !== "curated_assembled",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl">Simulasi berwaktu</h1>
        <p className="text-[var(--muted)]">
          Simulasi resmi, paket curated yang disusun AI, dan simulasi soal AI
          baru. Tutor AI hanya tersedia setelah submit.
        </p>
      </div>

      <GenerateCuratedMockChallenge />
      <GenerateMockChallenge />

      <section className="space-y-4">
        <h2 className="display text-2xl">Bank Soal Simulasi</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {official.map((m) => (
            <div key={m.id} className="panel rounded-3xl p-5">
              <h3 className="display text-2xl">{m.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{m.description}</p>
              <p className="mt-3 text-sm">
                {m.durationMinutes} menit · {m.problemIds.length} soal
              </p>
              <Link href={`/mock/${m.id}`} className="btn btn-primary mt-4">
                Mulai
              </Link>
            </div>
          ))}
        </div>
      </section>

      {curatedAssembled.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="display text-2xl">Simulasi curated (disusun AI)</h2>
            <p className="text-sm text-[var(--muted)]">
              Soal dari bank curated, dipilih & diurutkan LLM — dibagikan ke
              semua siswa.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {curatedAssembled.map((m) => (
              <div key={m.id} className="panel rounded-3xl p-5">
                <h3 className="display text-2xl">{m.title}</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {m.description}
                </p>
                <p className="mt-3 text-sm">
                  {m.durationMinutes} menit · {m.problemIds.length} soal
                  {m.difficultyMode
                    ? ` · ${labelDifficultyMode(m.difficultyMode as DifficultyMode)}`
                    : ""}
                  {m.creatorName ? ` · ${m.creatorName}` : ""}
                </p>
                <Link href={`/mock/${m.id}`} className="btn btn-primary mt-4">
                  Mulai
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {aiGenerated.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="display text-2xl">Simulasi AI bersama</h2>
            <p className="text-sm text-[var(--muted)]">
              10 soal baru dari LLM / 30 menit.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {aiGenerated.map((m) => (
              <div key={m.id} className="panel rounded-3xl p-5">
                <h3 className="display text-2xl">{m.title}</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {m.description}
                </p>
                <p className="mt-3 text-sm">
                  {m.durationMinutes} menit · {m.problemIds.length} soal
                  {m.difficultyMode
                    ? ` · ${labelDifficultyMode(m.difficultyMode as DifficultyMode)}`
                    : ""}
                  {m.creatorName ? ` · ${m.creatorName}` : ""}
                </p>
                <Link href={`/mock/${m.id}`} className="btn btn-primary mt-4">
                  Mulai
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

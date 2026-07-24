import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listAllMocks, type SharedMockExam } from "@/lib/content/shared";
import { GenerateMockChallenge } from "@/components/generate-mock-challenge";
import { GenerateCuratedMockChallenge } from "@/components/generate-curated-mock-challenge";
import { labelDifficultyMode, type DifficultyMode } from "@/lib/ai/difficulty";

function MockRow({
  mock,
  metaExtra,
}: {
  mock: SharedMockExam;
  metaExtra?: string;
}) {
  return (
    <div className="panel flex flex-col gap-2 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <h3 className="display text-xl leading-snug">{mock.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
          {mock.description}
        </p>
        <p className="mt-1.5 text-xs text-[var(--muted)]">
          {mock.durationMinutes} mnt · {mock.problemIds.length} soal
          {metaExtra ? ` · ${metaExtra}` : ""}
        </p>
      </div>
      <Link
        href={`/mock/${mock.id}`}
        className="btn btn-primary shrink-0 !px-4 !py-2 text-sm"
      >
        Mulai
      </Link>
    </div>
  );
}

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-3xl md:text-4xl">Simulasi berwaktu</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Pilih paket di bank soal, atau buka generator di bawah jika ingin
            paket baru. Tutor AI hanya setelah submit.
          </p>
        </div>
        <a
          href="#buat-simulasi"
          className="btn btn-secondary !px-3 !py-1.5 text-sm"
        >
          Buat paket baru
        </a>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-2xl">Bank Soal Simulasi</h2>
          <span className="text-xs text-[var(--muted)]">
            bank soal
          </span>
        </div>
        <div className="space-y-2">
          {official.map((m) => (
            <MockRow key={m.id} mock={m} />
          ))}
        </div>
      </section>

      {curatedAssembled.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="display text-2xl">Curated (disusun AI)</h2>
            <p className="text-xs text-[var(--muted)]">
              Soal bank curated — dipilih & diurutkan LLM.
            </p>
          </div>
          <div className="space-y-2">
            {curatedAssembled.map((m) => (
              <MockRow
                key={m.id}
                mock={m}
                metaExtra={[
                  m.difficultyMode
                    ? labelDifficultyMode(m.difficultyMode as DifficultyMode)
                    : null,
                  m.creatorName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </div>
        </section>
      )}

      {aiGenerated.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="display text-2xl">Simulasi AI bersama</h2>
            <p className="text-xs text-[var(--muted)]">
              10 soal baru dari LLM / 30 menit.
            </p>
          </div>
          <div className="space-y-2">
            {aiGenerated.map((m) => (
              <MockRow
                key={m.id}
                mock={m}
                metaExtra={[
                  m.difficultyMode
                    ? labelDifficultyMode(m.difficultyMode as DifficultyMode)
                    : null,
                  m.creatorName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </div>
        </section>
      )}

      <section id="buat-simulasi" className="space-y-2 scroll-mt-20">
        <h2 className="display text-xl">Buat paket baru</h2>
        <p className="text-xs text-[var(--muted)]">
          Generator dilipat agar bank soal tetap mudah diakses. Buka hanya saat
          perlu.
        </p>
        <div className="space-y-2">
          <GenerateCuratedMockChallenge />
          <GenerateMockChallenge />
        </div>
      </section>
    </div>
  );
}

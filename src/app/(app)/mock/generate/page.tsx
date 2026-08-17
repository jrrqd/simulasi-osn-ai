import { requireUser } from "@/lib/session";
import { GenerateMockChallenge } from "@/components/generate-mock-challenge";
import { GenerateCuratedMockChallenge } from "@/components/generate-curated-mock-challenge";

export default async function MockGeneratePage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl md:text-4xl">Generate simulasi</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Susun paket dari bank curated atau generate soal AI baru (termasuk
          Kaggle / Final IOAI). Hasil muncul di Bank paket.
        </p>
      </div>
      <div className="space-y-3">
        <GenerateCuratedMockChallenge />
        <GenerateMockChallenge />
      </div>
    </div>
  );
}

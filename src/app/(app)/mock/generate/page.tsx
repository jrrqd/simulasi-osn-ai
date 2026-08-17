import { requireUser } from "@/lib/session";
import { GenerateMockChallenge } from "@/components/generate-mock-challenge";
import { GenerateCuratedMockChallenge } from "@/components/generate-curated-mock-challenge";
import { PageHeader } from "@/components/page-header";

export default async function MockGeneratePage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generate simulasi"
        description="Susun paket dari bank curated atau generate soal AI baru (termasuk Kaggle / Final IOAI). Hasil muncul di Bank paket."
      />
      <div className="space-y-3">
        <GenerateCuratedMockChallenge />
        <GenerateMockChallenge />
      </div>
    </div>
  );
}

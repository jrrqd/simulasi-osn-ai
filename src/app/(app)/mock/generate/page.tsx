import { requireUser } from "@/lib/session";
import { GenerateMockChallenge } from "@/components/generate-mock-challenge";
import { GenerateCuratedMockChallenge } from "@/components/generate-curated-mock-challenge";
import { PageHeader } from "@/components/page-header";
import { gateFeature } from "@/components/feature-gate";

export default async function MockGeneratePage() {
  const denied = await gateFeature("generate_simulasi");
  if (denied) return denied;

  await requireUser();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generate simulasi"
        description="Susun paket dari bank curated atau generate soal AI baru (Final EKKA Hari 1/2, Kaggle / Final IOAI). Hasil muncul di Bank Soal."
      />
      <div className="space-y-3">
        <GenerateCuratedMockChallenge />
        <GenerateMockChallenge />
      </div>
    </div>
  );
}

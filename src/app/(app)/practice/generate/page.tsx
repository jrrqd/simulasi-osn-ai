import { requireUser } from "@/lib/session";
import { GenerateChallenge } from "@/components/generate-challenge";
import { PageHeader } from "@/components/page-header";

export default async function PracticeGeneratePage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generate soal"
        description="Buat side quest AI baru. Hasil masuk bank AI bersama dan bisa dikerjakan di Bank soal."
      />
      <GenerateChallenge />
    </div>
  );
}

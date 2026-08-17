import { requireUser } from "@/lib/session";
import { GenerateChallenge } from "@/components/generate-challenge";

export default async function PracticeGeneratePage() {
  await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl">Generate soal</h1>
        <p className="text-[var(--muted)]">
          Buat side quest AI baru. Hasil masuk bank AI bersama dan bisa
          dikerjakan di Bank soal.
        </p>
      </div>
      <GenerateChallenge />
    </div>
  );
}

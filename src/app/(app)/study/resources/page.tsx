import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { IoaiResourcesPanel } from "@/components/ioai-resources-panel";
import { loadUserPhase } from "@/lib/user/load-phase";

export default async function StudyResourcesPage() {
  const user = await requireUser();
  const phase = await loadUserPhase(user.id);

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          title="Knowledge Hub"
          description="Resource bank silabus, soal, dan materi olimpiade AI (IOAI, NOAI, NEOAI, dan lain-lain). Tampil otomatis mengikuti track/topik yang sedang kamu pelajari."
        />
      </div>
      <IoaiResourcesPanel phase={phase} limit={48} />
    </div>
  );
}

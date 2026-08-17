import { AdminResourceManager } from "@/components/admin-resource-manager";
import { listIoaiResourceRecords } from "@/lib/content/ioai-resources";
import {
  IOAI_CATEGORIES,
  IOAI_DOMAINS,
} from "@/lib/content/resource-types";
import { TOPIC_LABELS, TRACKS, type TrackId } from "@/lib/content/types";
import { PageHeader } from "@/components/page-header";
import { buildIoaiReferenceContext } from "@/lib/content/ioai-resources";

export default async function AdminResourcesPage() {
  const resources = await listIoaiResourceRecords();
  const topics = Object.entries(TOPIC_LABELS).map(([id, label]) => ({
    id,
    label,
    track: (Object.keys(TRACKS) as TrackId[]).find((t) =>
      TRACKS[t].topics.includes(id),
    ),
  }));
  const initialPreview = await buildIoaiReferenceContext({
    phase: "final",
    topic: "cnn-arsitektur",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referensi IOAI"
        description="Knowledge base tautan Education Hub & olimpiade nasional. Edit live untuk panel siswa (fase semifinal/final) dan blok inspirasi LLM — tanpa redeploy. Seed awal dari katalog JSON; baris admin baru bisa dihapus permanen, curated hanya di-hide."
      />
      <AdminResourceManager
        initialResources={resources}
        initialCategories={[...IOAI_CATEGORIES]}
        initialDomains={[...IOAI_DOMAINS]}
        initialTopics={topics}
        initialPreview={initialPreview}
        initialPreviewTopic="cnn-arsitektur"
      />
    </div>
  );
}

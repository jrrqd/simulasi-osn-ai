import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { PerformanceAssistant } from "@/components/performance-assistant";
import { PerformanceHistory } from "@/components/performance-history";
import { canUseAiAssistant } from "@/components/feature-gate";

export default async function PerformanceHistoryPage() {
  await requireUser();
  const showAssistant = await canUseAiAssistant();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat"
        description="Hasil latihan dan simulasi yang sudah kamu kerjakan."
      />
      <PerformanceHistory />
      {showAssistant ? <PerformanceAssistant /> : null}
    </div>
  );
}

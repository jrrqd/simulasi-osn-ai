import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { PerformanceAssistant } from "@/components/performance-assistant";
import { PerformanceHistory } from "@/components/performance-history";

export default async function PerformanceHistoryPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat"
        description="Hasil latihan dan simulasi yang sudah kamu kerjakan."
      />
      <PerformanceHistory />
      <PerformanceAssistant />
    </div>
  );
}

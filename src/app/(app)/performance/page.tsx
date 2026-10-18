import { requireUser } from "@/lib/session";
import { PerformanceDashboard } from "@/components/performance-dashboard";
import { PerformanceAssistant } from "@/components/performance-assistant";
import { PageHeader } from "@/components/page-header";
import { canUseAiAssistant } from "@/components/feature-gate";
import { getPerformanceData } from "@/lib/analytics/performance-data";

export default async function PerformancePage() {
  const user = await requireUser();
  const [showAssistant, initialData] = await Promise.all([
    canUseAiAssistant(),
    getPerformanceData(user.id),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Performa"
        description="Mastery, tren, dan rekomendasi gap berdasarkan attempt nyata."
      />
      <PerformanceDashboard
        initialData={JSON.parse(JSON.stringify(initialData))}
      />
      {showAssistant ? <PerformanceAssistant /> : null}
    </div>
  );
}

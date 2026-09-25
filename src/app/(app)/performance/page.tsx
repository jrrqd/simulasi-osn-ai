import { requireUser } from "@/lib/session";
import { PerformanceDashboard } from "@/components/performance-dashboard";
import { PerformanceAssistant } from "@/components/performance-assistant";
import { PageHeader } from "@/components/page-header";
import { canUseAiAssistant } from "@/components/feature-gate";

export default async function PerformancePage() {
  await requireUser();
  const showAssistant = await canUseAiAssistant();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Performa"
        description="Mastery, tren, dan rekomendasi gap berdasarkan attempt nyata."
      />
      <PerformanceDashboard />
      {showAssistant ? <PerformanceAssistant /> : null}
    </div>
  );
}

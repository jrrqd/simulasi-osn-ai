import { requireUser } from "@/lib/session";
import { PerformanceDashboard } from "@/components/performance-dashboard";

export default async function PerformancePage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl">Performa</h1>
        <p className="text-[var(--muted)]">
          Mastery, tren, dan rekomendasi gap berdasarkan attempt nyata.
        </p>
      </div>
      <PerformanceDashboard />
    </div>
  );
}

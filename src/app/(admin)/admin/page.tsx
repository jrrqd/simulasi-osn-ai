import { AdminOverview } from "@/components/admin-overview";
import { PageHeader } from "@/components/page-header";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Ringkasan platform"
        title="Dashboard admin"
        description="Pantau aktivitas belajar siswa dan ketersediaan layanan AI."
      />
      <AdminOverview />
    </div>
  );
}

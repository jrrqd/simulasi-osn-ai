import { AdminOverview } from "@/components/admin-overview";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
          Ringkasan platform
        </p>
        <h1 className="display text-4xl">Dashboard admin</h1>
        <p className="text-[var(--muted)]">
          Pantau aktivitas belajar siswa dan ketersediaan layanan AI.
        </p>
      </div>
      <AdminOverview />
    </div>
  );
}

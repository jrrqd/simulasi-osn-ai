import { AdminProblemManager } from "@/components/admin-problem-manager";

export default function AdminProblemsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-4xl">Bank soal</h1>
        <p className="text-[var(--muted)]">
          Kelola semua soal latihan — curated dan bank AI bersama (buat, edit,
          sembunyikan/hapus).
        </p>
      </div>
      <AdminProblemManager />
    </div>
  );
}

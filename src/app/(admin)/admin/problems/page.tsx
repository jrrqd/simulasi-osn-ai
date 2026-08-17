import { AdminProblemManager } from "@/components/admin-problem-manager";
import { PageHeader } from "@/components/page-header";

export default function AdminProblemsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank soal"
        description="Kelola semua soal latihan — curated dan bank AI bersama (buat, edit, sembunyikan/hapus)."
      />
      <AdminProblemManager />
    </div>
  );
}

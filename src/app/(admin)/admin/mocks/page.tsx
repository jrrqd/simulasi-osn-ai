import { AdminMockManager } from "@/components/admin-mock-manager";
import { AdminMockCompositionPreview } from "@/components/admin-mock-builder";
import { PageHeader } from "@/components/page-header";

export default function AdminMocksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank simulasi"
        description="Kelola paket simulasi berwaktu — curated dan AI/assembled. Sembunyikan dari daftar siswa, atau hapus permanen paket AI. Komposisi generate mengikuti format OSN AI 2026 (isian ×1 + coding ×2)."
      />
      <AdminMockCompositionPreview />
      <AdminMockManager />
    </div>
  );
}

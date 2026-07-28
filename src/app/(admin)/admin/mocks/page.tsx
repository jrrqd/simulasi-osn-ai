import { AdminMockManager } from "@/components/admin-mock-manager";
import { AdminMockCompositionPreview } from "@/components/admin-mock-builder";

export default function AdminMocksPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-4xl">Bank simulasi</h1>
        <p className="text-[var(--muted)]">
          Kelola paket simulasi berwaktu — curated dan AI/assembled. Sembunyikan
          dari daftar siswa, atau hapus permanen paket AI. Komposisi generate
          mengikuti format OSN AI 2026 (isian ×1 + coding ×2).
        </p>
      </div>
      <AdminMockCompositionPreview />
      <AdminMockManager />
    </div>
  );
}

import { AdminMockManager } from "@/components/admin-mock-manager";

export default function AdminMocksPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-4xl">Bank simulasi</h1>
        <p className="text-[var(--muted)]">
          Kelola paket simulasi berwaktu — curated dan AI/assembled (buat, edit,
          sembunyikan/hapus).
        </p>
      </div>
      <AdminMockManager />
    </div>
  );
}

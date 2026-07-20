import { AdminUserManager } from "@/components/admin-user-manager";

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl">Pengguna</h1>
        <p className="text-[var(--muted)]">
          Tambah, ubah, hapus, dan buka laporan detail setiap siswa.
        </p>
      </div>
      <AdminUserManager />
    </div>
  );
}

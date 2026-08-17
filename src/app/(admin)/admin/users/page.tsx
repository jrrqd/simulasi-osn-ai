import { AdminUserManager } from "@/components/admin-user-manager";
import { PageHeader } from "@/components/page-header";

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengguna"
        description="Tambah, ubah, hapus, dan buka laporan detail setiap siswa."
      />
      <AdminUserManager />
    </div>
  );
}

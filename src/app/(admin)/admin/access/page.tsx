import { AdminAccessEditor } from "@/components/admin-access-editor";
import { PageHeader } from "@/components/page-header";

export default function AdminAccessPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Akses per tipe akun"
        description="Atur fasilitas yang tersedia untuk Gratis, VIP, Test, dan Admin. Perubahan langsung berlaku setelah disimpan."
      />
      <AdminAccessEditor />
    </div>
  );
}

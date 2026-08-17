import { AdminCountdownPhases } from "@/components/admin-countdown-phases";
import { PageHeader } from "@/components/page-header";

export default function AdminCountdownPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Countdown seleksi"
        description="Atur fase hitung mundur di beranda — buat, ubah, nonaktifkan, atau hapus. Jika kosong, situs memakai jadwal bawaan."
      />
      <AdminCountdownPhases />
    </div>
  );
}

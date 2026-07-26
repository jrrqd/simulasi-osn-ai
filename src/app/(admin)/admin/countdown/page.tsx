import { AdminCountdownPhases } from "@/components/admin-countdown-phases";

export default function AdminCountdownPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-4xl">Countdown seleksi</h1>
        <p className="text-[var(--muted)]">
          Atur fase hitung mundur di beranda — buat, ubah, nonaktifkan, atau
          hapus. Jika kosong, situs memakai jadwal bawaan.
        </p>
      </div>
      <AdminCountdownPhases />
    </div>
  );
}

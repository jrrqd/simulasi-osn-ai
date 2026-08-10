import { AdminResourcesManager } from "@/components/admin-resources-manager";

export default function AdminResourcesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-4xl">Referensi IOAI</h1>
        <p className="text-[var(--muted)]">
          Katalog Education Hub + panduan belajar Bahasa Indonesia. Edit
          ringkasan / kunci / pembahasan tanpa redeploy.
        </p>
      </div>
      <AdminResourcesManager />
    </div>
  );
}

import { AdminNewsSettings } from "@/components/admin-news-settings";
import { PageHeader } from "@/components/page-header";

export default function AdminNewsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Berita"
        description="Kelola kata kunci RSS dan jadwal pembaruan hub berita publik."
      />
      <AdminNewsSettings />
    </div>
  );
}

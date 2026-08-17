import { AdminAiSettings } from "@/components/admin-ai-settings";
import { PageHeader } from "@/components/page-header";

export default function AdminAiPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="LLM bersama"
        description="Sediakan AI untuk seluruh siswa, sambil tetap mengizinkan BYOK."
      />
      <AdminAiSettings />
    </div>
  );
}

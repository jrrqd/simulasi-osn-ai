import { AdminAiSettings } from "@/components/admin-ai-settings";

export default function AdminAiPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl">LLM bersama</h1>
        <p className="text-[var(--muted)]">
          Sediakan AI untuk seluruh siswa, sambil tetap mengizinkan BYOK.
        </p>
      </div>
      <AdminAiSettings />
    </div>
  );
}

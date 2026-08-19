import { requireUser } from "@/lib/session";
import { AiSettingsForm } from "@/components/ai-settings-form";
import { PageHeader } from "@/components/page-header";

export default async function SettingsByokPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader
        title="BYOK"
        description="Pasang API key pribadi (Bring Your Own Key) untuk memakai providermu sendiri."
      />
      <AiSettingsForm />
    </div>
  );
}

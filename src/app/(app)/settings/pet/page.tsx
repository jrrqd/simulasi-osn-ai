import { requireUser } from "@/lib/session";
import { AssistantPetSettings } from "@/components/assistant-pet-settings";
import { PageHeader } from "@/components/page-header";

export default async function SettingsPetPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pet"
        description="Pilih maskot untuk tombol chat mengambang di Belajar dan Performa."
      />
      <AssistantPetSettings />
    </div>
  );
}

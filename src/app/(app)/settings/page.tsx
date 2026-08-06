import { requireUser } from "@/lib/session";
import { AiSettingsForm } from "@/components/ai-settings-form";
import { AssistantPetSettings } from "@/components/assistant-pet-settings";
import { PhaseSettings } from "@/components/phase-settings";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <div className="panel rounded-3xl p-5">
        <h2 className="display text-2xl">Akun</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {user.name} · {user.email}
        </p>
      </div>
      <PhaseSettings />
      <AssistantPetSettings />
      <AiSettingsForm />
    </div>
  );
}

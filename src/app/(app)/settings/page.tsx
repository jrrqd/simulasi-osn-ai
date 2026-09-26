import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { PhaseSettings } from "@/components/phase-settings";
import { AccountPrivacy } from "@/components/account-privacy";
import { SettingsAccountSummary } from "@/components/settings-account-summary";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan"
        description="Akun, akses fasilitas, dan tahap kompetisi."
      />
      <SettingsAccountSummary
        userId={user.id}
        name={user.name}
        email={user.email}
      />
      <PhaseSettings />
      <AccountPrivacy email={user.email} />
    </div>
  );
}

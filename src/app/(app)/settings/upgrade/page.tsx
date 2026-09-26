import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { SettingsUpgradeClient } from "@/components/settings-upgrade-client";

export default async function SettingsUpgradePage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Upgrade"
        description="Aktifkan atau perpanjang VIP lewat Trakteer — asisten AI dan generate simulasi tanpa kuota harian."
      />
      <SettingsUpgradeClient userEmail={user.email} />
    </div>
  );
}

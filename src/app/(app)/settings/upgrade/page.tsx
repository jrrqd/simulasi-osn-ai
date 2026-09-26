import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import { SettingsUpgradeClient } from "@/components/settings-upgrade-client";

export default async function SettingsUpgradePage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Upgrade VIP"
        description="Bayar Rp 50.000 via Trakteer untuk VIP 30 hari — asisten AI tanpa batas kuota."
      />
      <SettingsUpgradeClient userEmail={user.email} />
    </div>
  );
}

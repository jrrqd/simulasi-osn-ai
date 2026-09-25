import Link from "next/link";
import {
  featureLabel,
  type AccessFeatureId,
  type AccessMatrix,
} from "@/lib/access/catalog";
import { getAccessMatrix, hasFeature } from "@/lib/access/matrix";
import { loadUserAccess } from "@/lib/user/load-user-access";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page-header";
import type { UserAccess } from "@/lib/user/user-type";

export function FeatureDenied({ feature }: { feature: AccessFeatureId }) {
  const label = featureLabel(feature);
  return (
    <div className="panel space-y-4 rounded-3xl p-8">
      <PageHeader
        title="Tidak termasuk paket"
        description={`${label} belum tersedia untuk tipe akun kamu. Hubungi admin jika kamu merasa ini keliru, atau upgrade ke VIP bila fasilitas itu hanya untuk VIP.`}
      />
      <div className="flex flex-wrap gap-3">
        <Link href="/study" className="btn btn-secondary">
          Kembali ke Belajar
        </Link>
        <Link href="/settings" className="btn btn-primary">
          Pengaturan akun
        </Link>
      </div>
    </div>
  );
}

export async function loadAccessContext(): Promise<{
  access: UserAccess | null;
  matrix: AccessMatrix;
}> {
  const sessionUser = await requireUser();
  const access = await loadUserAccess(sessionUser.id);
  const matrix = await getAccessMatrix();
  return { access, matrix };
}

/**
 * Returns null when access is allowed, or a denial React node when blocked.
 * Call at the top of a page/layout and early-return the denial.
 */
export async function gateFeature(
  feature: AccessFeatureId,
): Promise<React.ReactNode | null> {
  const { access, matrix } = await loadAccessContext();
  if (!access || !hasFeature(access, feature, matrix)) {
    return <FeatureDenied feature={feature} />;
  }
  return null;
}

/** True when the user has at least one of the listed facilities. */
export async function gateAnyFeature(
  features: AccessFeatureId[],
  fallbackFeature: AccessFeatureId,
): Promise<React.ReactNode | null> {
  const { access, matrix } = await loadAccessContext();
  if (!access || !features.some((f) => hasFeature(access, f, matrix))) {
    return <FeatureDenied feature={fallbackFeature} />;
  }
  return null;
}

/** Whether the floating AI assistant is allowed for the current user. */
export async function canUseAiAssistant(): Promise<boolean> {
  const { access, matrix } = await loadAccessContext();
  return Boolean(access && hasFeature(access, "ai_assistant", matrix));
}

/** Same check when the caller already has a user id (e.g. app shell). */
export async function userCanUseAiAssistant(userId: string): Promise<boolean> {
  const access = await loadUserAccess(userId);
  if (!access) return false;
  return hasFeature(access, "ai_assistant", await getAccessMatrix());
}

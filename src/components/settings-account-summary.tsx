import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import {
  ACCESS_FEATURES,
  type AccessFeatureId,
} from "@/lib/access/catalog";
import { getAccessMatrix, hasFeature } from "@/lib/access/matrix";
import { FREE_AI_ASSISTANT_DAILY_LIMIT } from "@/lib/ai/assistant-quota";
import { loadUserAccess } from "@/lib/user/load-user-access";
import {
  USER_TYPE_LABELS,
  type UserAccess,
} from "@/lib/user/user-type";
import { VIP_DURATION_DAYS, VIP_PRICE_IDR } from "@/lib/user/set-user-type";

function formatIdr(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function featureNote(
  id: AccessFeatureId,
  access: UserAccess,
  enabled: boolean,
): string | null {
  if (id === "bypass_ai_assistant_quota" && !enabled) {
    return `${FREE_AI_ASSISTANT_DAILY_LIMIT} chat/hari · reset 00:00 WIB`;
  }
  if (id === "bypass_simulasi_quota" && !enabled) {
    return "1 generate simulasi/hari";
  }
  if (id === "ai_assistant" && enabled && access.personalReady) {
    return "BYOK aktif · kuota asisten tidak berlaku";
  }
  return null;
}

/** Features most relevant for students on the settings page. */
const STUDENT_FEATURE_ORDER: AccessFeatureId[] = [
  "study",
  "practice",
  "mock_curated",
  "generate_simulasi",
  "ai_assistant",
  "bypass_ai_assistant_quota",
  "bypass_simulasi_quota",
];

export async function SettingsAccountSummary({
  userId,
  name,
  email,
}: {
  userId: string;
  name: string;
  email: string;
}) {
  const access = await loadUserAccess(userId);
  if (!access) return null;

  const matrix = await getAccessMatrix();
  const db = await getDb();
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });

  const typeLabel = access.isAdmin
    ? "Admin"
    : USER_TYPE_LABELS[access.userType];
  const vipUntil =
    !access.isAdmin &&
    access.userType === "vip" &&
    row?.vipExpiresAt
      ? row.vipExpiresAt.toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
          dateStyle: "long",
          timeStyle: "short",
        })
      : null;

  const featureIds = access.isAdmin
    ? ACCESS_FEATURES.map((f) => f.id)
    : STUDENT_FEATURE_ORDER;

  const features = featureIds.map((id) => {
    const def = ACCESS_FEATURES.find((f) => f.id === id)!;
    const enabled = hasFeature(access, id, matrix);
    return {
      id,
      label: def.label,
      description: def.description,
      enabled,
      note: featureNote(id, access, enabled),
    };
  });

  const canUpgrade =
    !access.isAdmin && access.userType === "free";

  return (
    <div className="panel space-y-5 rounded-3xl p-5">
      <div>
        <h2 className="display text-2xl">Akun</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {name} · {email}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Jenis akun
        </p>
        <p className="text-lg font-semibold text-[var(--ink)]">{typeLabel}</p>
        {vipUntil ? (
          <p className="text-sm text-[var(--muted)]">
            VIP sampai <strong>{vipUntil} WIB</strong>
          </p>
        ) : null}
        {access.userType === "test" && !access.isAdmin ? (
          <p className="text-sm text-[var(--muted)]">
            Akun uji — fasilitas mengikuti matriks Test.
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          Akses fasilitas
        </p>
        <ul className="space-y-2">
          {features.map((f) => (
            <li
              key={f.id}
              className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-2 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--ink)]">
                  {f.label}
                </p>
                <p className="text-xs text-[var(--muted)]">{f.description}</p>
                {f.note ? (
                  <p className="mt-0.5 text-xs text-[var(--accent-2)]">
                    {f.note}
                  </p>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  f.enabled
                    ? "bg-[rgba(15,110,86,0.12)] text-[var(--accent)]"
                    : "bg-black/5 text-[var(--muted)]"
                }`}
              >
                {f.enabled ? "Aktif" : "Tidak"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {canUpgrade ? (
        <div className="rounded-2xl bg-[rgba(15,110,86,0.08)] px-4 py-3">
          <p className="text-sm text-[var(--ink)]">
            Upgrade ke VIP ({formatIdr(VIP_PRICE_IDR)} / {VIP_DURATION_DAYS}{" "}
            hari) untuk asisten AI dan generate simulasi tanpa kuota harian.
          </p>
          <Link
            href="/settings/upgrade"
            className="btn btn-primary mt-3 inline-flex"
          >
            Upgrade ke VIP
          </Link>
        </div>
      ) : null}

      {!canUpgrade && access.userType === "vip" && !access.isAdmin ? (
        <p className="text-sm text-[var(--muted)]">
          Perpanjang VIP di{" "}
          <Link
            href="/settings/upgrade"
            className="font-medium text-[var(--accent)] underline"
          >
            Pengaturan → Upgrade
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}

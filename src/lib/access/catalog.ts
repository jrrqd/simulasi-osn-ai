/** Stable facility ids for the per-tier access matrix. */

export const ACCESS_TIERS = ["free", "vip", "test", "admin"] as const;
export type AccessTier = (typeof ACCESS_TIERS)[number];

export const ACCESS_TIER_LABELS: Record<AccessTier, string> = {
  free: "Gratis",
  vip: "VIP",
  test: "Test",
  admin: "Admin",
};

export const ACCESS_FEATURE_IDS = [
  "study",
  "practice",
  "mock_curated",
  "generate_simulasi",
  "ai_assistant",
  "bypass_simulasi_quota",
  "bypass_rate_limits",
  "admin_panel",
] as const;

export type AccessFeatureId = (typeof ACCESS_FEATURE_IDS)[number];

export type AccessFeatureDef = {
  id: AccessFeatureId;
  label: string;
  description: string;
  /** When true, only Admin may have it and the checkbox cannot be toggled. */
  locked?: boolean;
};

export const ACCESS_FEATURES: AccessFeatureDef[] = [
  {
    id: "study",
    label: "Belajar",
    description: "Modul belajar dan cek konsep.",
  },
  {
    id: "practice",
    label: "Latihan",
    description: "Bank soal latihan dan generate soal AI.",
  },
  {
    id: "mock_curated",
    label: "Simulasi kurasi",
    description: "Mengerjakan paket simulasi dari bank curated.",
  },
  {
    id: "generate_simulasi",
    label: "Generate simulasi AI",
    description: "Membuat paket simulasi baru (AI atau curated).",
  },
  {
    id: "ai_assistant",
    label: "Asisten AI",
    description:
      "Tombol asisten mengambang di Belajar, Latihan, dan Performa (serta asisten admin).",
  },
  {
    id: "bypass_simulasi_quota",
    label: "Tanpa kuota simulasi",
    description:
      "Lewati batas 1×/hari generate simulasi (akun gratis tetap terbatas).",
  },
  {
    id: "bypass_rate_limits",
    label: "Lewati rate limit",
    description: "Tidak terkena batas permintaan API per menit.",
  },
  {
    id: "admin_panel",
    label: "Panel admin",
    description: "Akses dashboard admin. Hanya untuk role Admin.",
    locked: true,
  },
];

export type AccessFeatureFlags = Record<AccessFeatureId, boolean>;
export type AccessMatrix = Record<AccessTier, AccessFeatureFlags>;

function flags(
  enabled: AccessFeatureId[],
): AccessFeatureFlags {
  const set = new Set(enabled);
  return Object.fromEntries(
    ACCESS_FEATURE_IDS.map((id) => [id, set.has(id)]),
  ) as AccessFeatureFlags;
}

/** Matches hard-coded behavior before the matrix existed. */
export const DEFAULT_ACCESS_MATRIX: AccessMatrix = {
  free: flags([
    "study",
    "practice",
    "mock_curated",
    "generate_simulasi",
    "ai_assistant",
  ]),
  vip: flags([
    "study",
    "practice",
    "mock_curated",
    "generate_simulasi",
    "ai_assistant",
    "bypass_simulasi_quota",
  ]),
  test: flags([
    "study",
    "practice",
    "mock_curated",
    "generate_simulasi",
    "ai_assistant",
    "bypass_simulasi_quota",
    "bypass_rate_limits",
  ]),
  admin: flags([...ACCESS_FEATURE_IDS]),
};

export function isAccessTier(value: unknown): value is AccessTier {
  return (
    typeof value === "string" &&
    (ACCESS_TIERS as readonly string[]).includes(value)
  );
}

export function isAccessFeatureId(value: unknown): value is AccessFeatureId {
  return (
    typeof value === "string" &&
    (ACCESS_FEATURE_IDS as readonly string[]).includes(value)
  );
}

/** Normalize partial JSON into a full matrix; admin_panel stays locked. */
export function normalizeAccessMatrix(
  raw: Partial<Record<AccessTier, Partial<AccessFeatureFlags>>> | null | undefined,
): AccessMatrix {
  const out = structuredClone(DEFAULT_ACCESS_MATRIX);
  for (const tier of ACCESS_TIERS) {
    const row = raw?.[tier];
    if (!row || typeof row !== "object") continue;
    for (const id of ACCESS_FEATURE_IDS) {
      if (typeof row[id] === "boolean") {
        out[tier][id] = row[id]!;
      }
    }
  }
  // Locked rule: admin_panel only for admin, always on for admin.
  for (const tier of ACCESS_TIERS) {
    out[tier].admin_panel = tier === "admin";
  }
  return out;
}

export function featureLabel(id: AccessFeatureId): string {
  return ACCESS_FEATURES.find((f) => f.id === id)?.label ?? id;
}

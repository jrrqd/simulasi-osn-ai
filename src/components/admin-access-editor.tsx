"use client";

import { appPath } from "@/lib/app-path";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  AccessFeatureDef,
  AccessFeatureFlags,
  AccessFeatureId,
  AccessMatrix,
  AccessTier,
} from "@/lib/access/catalog";

type AccessPayload = {
  tiers: AccessTier[];
  tierLabels: Record<AccessTier, string>;
  features: AccessFeatureDef[];
  matrix: AccessMatrix;
};

export function AdminAccessEditor() {
  const [data, setData] = useState<AccessPayload | null>(null);
  const [matrix, setMatrix] = useState<AccessMatrix | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(appPath("/api/admin/access"));
    const json = (await response.json()) as AccessPayload & { error?: string };
    if (!response.ok) {
      setMessage(json.error || "Gagal memuat");
      return;
    }
    setData(json);
    setMatrix(json.matrix);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(tier: AccessTier, feature: AccessFeatureId) {
    if (!matrix || !data) return;
    const def = data.features.find((f) => f.id === feature);
    if (def?.locked) return;
    setMatrix({
      ...matrix,
      [tier]: {
        ...matrix[tier],
        [feature]: !matrix[tier][feature],
      } satisfies AccessFeatureFlags,
    });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!matrix) return;
    setLoading(true);
    setMessage("");
    const response = await fetch(appPath("/api/admin/access"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matrix }),
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(json.error || "Gagal menyimpan");
      return;
    }
    setMatrix(json.matrix);
    setMessage("Matriks akses tersimpan.");
  }

  async function resetDefaults() {
    if (!data) return;
    setLoading(true);
    setMessage("");
    // Reload defaults by saving an empty partial — server merges with defaults
    // then re-applies locked admin_panel. Easier: fetch defaults from a full
    // matrix rebuild on the client matching catalog defaults via PUT of
    // current GET after we clear? Just re-fetch and ask server to save
    // DEFAULT by sending only locked-safe empty object.
    const response = await fetch(appPath("/api/admin/access"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matrix: {} }),
    });
    const json = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(json.error || "Gagal mereset");
      return;
    }
    setMatrix(json.matrix);
    setMessage("Dikembalikan ke default.");
  }

  if (!data || !matrix) {
    return (
      <p className="text-sm text-[var(--muted)]">
        {message || "Memuat matriks akses…"}
      </p>
    );
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="panel overflow-x-auto rounded-3xl p-4">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left">
              <th className="py-3 pr-4 font-semibold">Fasilitas</th>
              {data.tiers.map((tier) => (
                <th key={tier} className="px-3 py-3 text-center font-semibold">
                  {data.tierLabels[tier]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.features.map((feature) => (
              <tr
                key={feature.id}
                className="border-b border-[var(--line)]/60 align-top"
              >
                <td className="py-3 pr-4">
                  <div className="font-medium">{feature.label}</div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {feature.description}
                    {feature.locked ? " (terkunci)" : ""}
                  </div>
                </td>
                {data.tiers.map((tier) => {
                  const checked = matrix[tier][feature.id];
                  const locked = Boolean(feature.locked);
                  return (
                    <td key={tier} className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--accent)]"
                        checked={checked}
                        disabled={locked}
                        onChange={() => toggle(tier, feature.id)}
                        aria-label={`${feature.label} untuk ${data.tierLabels[tier]}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--muted)]">
        Panel admin hanya untuk kolom Admin dan tidak bisa diubah. Kunci BYOK
        pribadi tetap melewati kuota simulasi di luar matriks ini. Upgrade
        Gratis → VIP nanti cukup mengubah tipe user; fasilitas mengikuti
        kolom VIP.
      </p>

      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Menyimpan…" : "Simpan"}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={loading}
          onClick={() => void resetDefaults()}
        >
          Reset default
        </button>
      </div>
      {message ? (
        <p className="text-sm text-[var(--muted)]">{message}</p>
      ) : null}
    </form>
  );
}

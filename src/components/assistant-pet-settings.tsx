"use client";

import { useEffect, useState } from "react";
import {
  ASSISTANT_PETS,
  parseAssistantPet,
  type AssistantPet,
} from "@/lib/assistant-pet";

export function AssistantPetSettings() {
  const [pet, setPet] = useState<AssistantPet>("cat");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal memuat");
        setPet(parseAssistantPet(data.assistantPet));
      })
      .catch((err) =>
        setMessage(err instanceof Error ? err.message : "Gagal memuat"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function save(next: AssistantPet) {
    setSaving(true);
    setMessage("");
    const previous = pet;
    setPet(next);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantPet: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setPet(parseAssistantPet(data.assistantPet));
      setMessage("Pet asisten tersimpan.");
    } catch (err) {
      setPet(previous);
      setMessage(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel space-y-4 rounded-3xl p-5">
      <div>
        <h2 className="display text-2xl">Pet asisten AI</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pilih maskot animasi untuk tombol chat mengambang di halaman Belajar
          dan Performa.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Memuat…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {ASSISTANT_PETS.map((option) => {
            const selected = pet === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => save(option.value)}
                className={`rounded-2xl border px-3 py-4 text-left transition ${
                  selected
                    ? "border-[var(--accent)] bg-[rgba(15,110,86,0.08)]"
                    : "border-[var(--line)] bg-white/50 hover:bg-white/80"
                }`}
              >
                <div className="flex h-20 items-center justify-center">
                  {option.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={option.src}
                      alt={option.label}
                      width={72}
                      height={72}
                      className="h-[72px] w-[72px] object-contain"
                      style={{ imageRendering: "pixelated" }}
                    />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-xl font-bold text-white">
                      AI
                    </span>
                  )}
                </div>
                <p className="mt-2 text-center text-sm font-semibold">
                  {option.label}
                </p>
              </button>
            );
          })}
        </div>
      )}
      {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
    </div>
  );
}

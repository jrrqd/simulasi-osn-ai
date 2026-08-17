"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, ClipboardList, Timer } from "lucide-react";
import {
  PHASE_HINTS,
  PHASE_LABELS,
  PHASE_VALUES,
  type Phase,
} from "@/lib/user/phase";

const panels = [
  {
    icon: BookOpen,
    title: "Belajar",
    body: "Ikuti modul silabus track A–D, terutama ML dan neural nets untuk seleksi EKKA.",
  },
  {
    icon: ClipboardList,
    title: "Latihan",
    body: "Kerjakan bank soal curated atau generate challenge AI sesuai topik yang masih lemah.",
  },
  {
    icon: Timer,
    title: "Simulasi",
    body: "Uji diri dengan mock berwaktu. Tutor AI nonaktif selama ujian — fokus sampai submit.",
  },
];

export function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState<"intro" | "phase">("intro");
  const [phase, setPhase] = useState<Phase>("semifinal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function complete() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completeOnboarding: true, phase }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Gagal menyimpan");
      router.replace("/study");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setLoading(false);
    }
  }

  if (step === "phase") {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <p className="text-sm font-medium text-[var(--accent)]">
            Tahap kompetisi
          </p>
          <h1 className="display mt-2 text-4xl md:text-5xl">
            Tahap OSN AI yang kamu ikuti?
          </h1>
          <p className="mt-3 text-[var(--muted)]">
            Kami menyesuaikan campuran topik mock AI dengan tahapmu. Kamu bisa
            mengubahnya lagi di Pengaturan.
          </p>
        </div>

        <div className="grid gap-3">
          {PHASE_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              className={`rounded-3xl border px-5 py-4 text-left transition ${
                phase === value
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--line)] bg-white/50"
              }`}
              onClick={() => setPhase(value)}
              disabled={loading}
            >
              <p className="font-semibold">{PHASE_LABELS[value]}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {PHASE_HINTS[value]}
              </p>
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={() => setStep("intro")}
          >
            Kembali
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading}
            onClick={complete}
          >
            {loading ? "Menyiapkan…" : "Mulai belajar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm font-medium text-[var(--accent)]">Selamat datang</p>
        <h1 className="display mt-2 text-4xl md:text-5xl">
          Siap mulai latihan OSN AI?
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Tiga jalur singkat supaya kamu tahu harus mulai dari mana.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {panels.map((panel) => (
          <div key={panel.title} className="panel rounded-3xl p-5">
            <panel.icon className="text-[var(--accent)]" size={22} />
            <h2 className="display mt-3 text-2xl">{panel.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{panel.body}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

      <button
        type="button"
        className="btn btn-primary"
        disabled={loading}
        onClick={() => setStep("phase")}
      >
        Lanjut
      </button>
    </div>
  );
}

export function OnboardingGate({ needsOnboarding }: { needsOnboarding: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!needsOnboarding) return;
    if (pathname === "/onboarding") return;
    router.replace("/onboarding");
  }, [needsOnboarding, pathname, router]);

  return null;
}

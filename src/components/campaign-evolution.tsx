import Link from "next/link";
import type { CampaignStages, CampaignStageId } from "@/lib/campaign-stages";

const STAGES: {
  id: CampaignStageId;
  label: string;
  href: string;
  /** Horizontal shift of the 300%-wide strip (0 / -100% / -200%). */
  shift: string;
}[] = [
  { id: "belajar", label: "Belajar", href: "/study", shift: "0%" },
  { id: "latihan", label: "Latihan", href: "/practice", shift: "-100%" },
  { id: "simulasi", label: "Simulasi", href: "/mock", shift: "-200%" },
];

function stageStat(stages: CampaignStages, id: CampaignStageId): string {
  if (id === "belajar") {
    return `${stages.belajar.completed}/${stages.belajar.total} level`;
  }
  if (id === "latihan") {
    return `${stages.latihan.correct}/${stages.latihan.attempts} quest`;
  }
  return `${stages.simulasi.completedMocks} mock`;
}

function stageHint(stages: CampaignStages, id: CampaignStageId): string {
  if (id === "belajar") return "Tutorial levels";
  if (id === "latihan") {
    return stages.latihan.unlocked
      ? "Side quests"
      : "Selesaikan 1 level tutorial";
  }
  return stages.simulasi.unlocked
    ? "Simulasi berwaktu"
    : "Kerjakan 1 side quest";
}

export function CampaignEvolution({
  stages,
  showLinks = true,
}: {
  stages: CampaignStages;
  /** Student dashboard shows CTA links; admin report usually hides them. */
  showLinks?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {STAGES.map((stage) => {
          const unlocked =
            stage.id === "belajar"
              ? true
              : stage.id === "latihan"
                ? stages.latihan.unlocked
                : stages.simulasi.unlocked;
          const current = stages.current === stage.id;

          return (
            <div
              key={stage.id}
              className={`relative overflow-hidden rounded-2xl border bg-black/[0.04] p-2 transition ${
                current
                  ? "border-[var(--accent)] shadow-[0_0_0_1px_rgba(15,110,86,0.25)]"
                  : "border-[var(--line)]"
              } ${unlocked ? "" : "opacity-55"}`}
            >
              <div
                className={`relative mx-auto aspect-square w-full max-w-[7.5rem] overflow-hidden rounded-xl bg-black ${
                  unlocked ? "" : "grayscale"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- GIF strip crop needs free positioning */}
                <img
                  src="/campaign/evolution.gif"
                  alt=""
                  className="pointer-events-none absolute inset-y-0 h-full max-w-none select-none"
                  style={{
                    width: "300%",
                    left: stage.shift,
                  }}
                />
                {!unlocked ? (
                  <div className="absolute inset-0 bg-black/35" aria-hidden />
                ) : null}
              </div>
              <div className="mt-2 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                  {stage.label}
                  {current ? " · sekarang" : ""}
                </p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {stageStat(stages, stage.id)}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  {stageHint(stages, stage.id)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {showLinks ? (
        <div className="flex flex-wrap gap-2">
          <Link href="/study" className="btn btn-secondary !py-1.5 text-sm">
            Buka tutorial
          </Link>
          <Link href="/practice" className="btn btn-primary !py-1.5 text-sm">
            Side quests
          </Link>
          <Link href="/mock" className="btn btn-secondary !py-1.5 text-sm">
            Simulasi
          </Link>
        </div>
      ) : null}
    </div>
  );
}

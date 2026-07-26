import Link from "next/link";
import type { CampaignStages, CampaignStageId } from "@/lib/campaign-stages";

const STAGES: {
  id: CampaignStageId;
  label: string;
  href: string;
  src: string;
}[] = [
  {
    id: "belajar",
    label: "Belajar",
    href: "/study",
    src: "/campaign/belajar.gif",
  },
  {
    id: "latihan",
    label: "Latihan",
    href: "/practice",
    src: "/campaign/latihan.gif",
  },
  {
    id: "simulasi",
    label: "Simulasi",
    href: "/mock",
    src: "/campaign/simulasi.gif",
  },
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
              className={`relative overflow-hidden rounded-2xl border bg-white/50 p-2 transition ${
                current
                  ? "border-[var(--accent)] shadow-[0_0_0_1px_rgba(15,110,86,0.25)]"
                  : "border-[var(--line)]"
              } ${unlocked ? "" : "opacity-55"}`}
            >
              <div
                className={`relative mx-auto flex aspect-square w-full max-w-[7.5rem] items-center justify-center overflow-hidden rounded-xl bg-transparent ${
                  unlocked ? "" : "grayscale"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF with transparency */}
                <img
                  src={stage.src}
                  alt=""
                  className="pointer-events-none h-[88%] w-[88%] object-contain select-none"
                />
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

import { requireUser } from "@/lib/session";
import { getLessons } from "@/lib/content/load";
import { listRecentLearningRecords } from "@/lib/ai/teaching-memory";
import { PageHeader } from "@/components/page-header";
import { TeachMeClient } from "@/components/teach-me-client";
import { canUseAiAssistant } from "@/components/feature-gate";
import Link from "next/link";
import { appPath } from "@/lib/app-path";

export default async function StudyTeachPage() {
  const user = await requireUser();
  const showAssistant = await canUseAiAssistant();
  const lessons = getLessons().map((l) => ({
    id: l.id,
    track: l.track,
    topic: l.topic,
    title: l.title,
  }));
  const memory = showAssistant
    ? await listRecentLearningRecords(user.id, 10)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teach me"
        description="Sesi mengajar privat berbasis skill /teach: misi dulu, satu unit per giliran, cek pemahaman, dan memori belajar lintas sesi."
      />
      {showAssistant ? (
        <TeachMeClient
          lessons={lessons}
          initialMemory={memory.map((r) => ({
            id: r.id,
            status: r.status,
            note: r.note,
            topic: r.topic,
            source: r.source,
          }))}
        />
      ) : (
        <div className="panel rounded-3xl p-5 text-sm text-[var(--muted)]">
          Asisten AI belum tersedia untuk akunmu.{" "}
          <Link
            href={appPath("/settings/upgrade")}
            className="font-medium text-[var(--accent)] hover:underline"
          >
            Upgrade
          </Link>{" "}
          atau pasang API key di{" "}
          <Link
            href={appPath("/settings/byok")}
            className="font-medium text-[var(--accent)] hover:underline"
          >
            BYOK
          </Link>
          .
        </div>
      )}
    </div>
  );
}

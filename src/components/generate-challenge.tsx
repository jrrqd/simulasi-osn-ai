"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TRACKS, TOPIC_LABELS } from "@/lib/content/types";
import {
  DIFFICULTY_MODES,
  type DifficultyMode,
} from "@/lib/ai/difficulty";
import { defaultIncludeFigures } from "@/lib/ai/diagrams";
import { TOPIC_PROMPT_MAX_LEN } from "@/lib/ai/curated-mock-size";
import { ChoiceChip } from "@/components/choice-chip";
import type { GenerationProgressEvent } from "@/lib/ai/generation-progress";
import { problemCacheKey } from "@/lib/content/problem-cache";
import {
  applyGenerationProgressEvent,
  GenerationProgressPanel,
  INITIAL_GENERATION_PROGRESS,
  readGenerationNdjsonStream,
  type GenerationProgressState,
} from "@/components/generation-progress";

type GenerationMode = "standard" | "custom" | "study-case";

const TOPIC_HINTS = Object.entries(TOPIC_LABELS).map(([id, label]) => ({
  id,
  label,
}));

export function GenerateChallenge() {
  const router = useRouter();
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>("standard");
  const [track, setTrack] = useState<"A" | "B" | "C" | "D">("B");
  const [topic, setTopic] = useState(TRACKS.B.topics[0]);
  const [topicPrompt, setTopicPrompt] = useState("");
  const [difficultyMode, setDifficultyMode] =
    useState<DifficultyMode>("medium");
  const [answerType, setAnswerType] = useState("numeric");
  const [problemCount, setProblemCount] = useState(4);
  const [includeFigures, setIncludeFigures] = useState(
    defaultIncludeFigures(TRACKS.B.topics[0]!),
  );
  const [figuresTouched, setFiguresTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<GenerationProgressState>(
    INITIAL_GENERATION_PROGRESS,
  );

  useEffect(() => {
    if (figuresTouched || generationMode === "custom") return;
    setIncludeFigures(defaultIncludeFigures(topic));
  }, [topic, figuresTouched, generationMode]);

  function appendTopicHint(label: string) {
    setTopicPrompt((prev) => {
      const next = prev.trim();
      if (!next) return label;
      if (next.toLowerCase().includes(label.toLowerCase())) return next;
      return `${next}, ${label}`;
    });
  }

  async function generate() {
    setLoading(true);
    setError("");
    const isCase = generationMode === "study-case";
    setProgress({
      ...INITIAL_GENERATION_PROGRESS,
      total: isCase ? problemCount : 1,
      phase: "planning",
      message: isCase
        ? "Menyiapkan studi kasus PREDIKSI…"
        : generationMode === "custom"
          ? "Menyiapkan generate dari brief topik…"
          : "Menyiapkan generate soal AI…",
    });
    try {
      const endpoint = isCase
        ? "/api/ai/generate-study-case"
        : "/api/ai/generate";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isCase
            ? {
                generationMode: "standard",
                track,
                topic,
                difficultyMode,
                problemCount,
                includeFigures,
              }
            : {
                generationMode:
                  generationMode === "custom" ? "custom" : "standard",
                track: generationMode === "standard" ? track : undefined,
                topic: generationMode === "standard" ? topic : undefined,
                topicPrompt:
                  generationMode === "custom"
                    ? topicPrompt.trim()
                    : undefined,
                difficultyMode,
                answerType,
                includeFigures,
              },
        ),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("ndjson")) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "Gagal generate",
        );
      }

      const caseProblemIds: string[] = [];
      let firstProblemId: string | null = null;
      let caseTitle = "";

      const done = await readGenerationNdjsonStream(
        res,
        (event: GenerationProgressEvent) => {
          setProgress((prev) => applyGenerationProgressEvent(prev, event));
          if (event.type === "slot_done") {
            caseProblemIds.push(event.problemId);
            if (!firstProblemId) firstProblemId = event.problemId;
          }
          if (event.type === "status" && event.message) {
            const idMatch = event.message.match(/firstProblemId=([^;]+)/);
            if (idMatch?.[1]) firstProblemId = idMatch[1];
            const titleMatch = event.message.match(
              /Studi kasus "([^"]+)"/,
            );
            if (titleMatch?.[1]) caseTitle = titleMatch[1];
          }
        },
      );

      const problemId = firstProblemId ?? done.problemId;
      const caseId = done.planId || "latest";

      setProgress((prev) => ({
        ...prev,
        phase: "saving",
        thinking: "",
        message: isCase
          ? "Memuat soal pertama dari studi kasus…"
          : "Memuat soal yang baru dibuat…",
        completedCount: isCase
          ? Math.max(prev.completedCount, caseProblemIds.length)
          : 1,
      }));

      const problemRes = await fetch(`/api/problems/${problemId}`);
      const problemData = await problemRes.json().catch(() => ({}));
      if (!problemRes.ok || !(problemData as { problem?: unknown }).problem) {
        throw new Error(
          (problemData as { error?: string }).error ||
            "Soal berhasil dibuat tetapi gagal dimuat",
        );
      }

      const problem = (problemData as { problem: { id: string } }).problem;
      sessionStorage.setItem(
        problemCacheKey(problem.id),
        JSON.stringify(
          (problemData as { problem: Record<string, unknown> }).problem,
        ),
      );
      if (isCase && caseProblemIds.length > 0) {
        const bundle = {
          caseId,
          caseTitle: caseTitle || undefined,
          problemIds: caseProblemIds,
        };
        sessionStorage.setItem(`study-case:${caseId}`, JSON.stringify(bundle));
        for (const id of caseProblemIds) {
          sessionStorage.setItem(
            `study-case-for:${id}`,
            JSON.stringify(bundle),
          );
        }
      }
      router.push(`/practice/${problem.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel space-y-3 rounded-3xl p-5">
      <p className="text-[var(--muted)]">
        Soal masuk bank AI bersama dan bisa dikerjakan siswa lain. Mode{" "}
        <strong>Studi kasus</strong> membuat 3–5 soal terkait bergaya PREDIKSI.
        Aktifkan <strong>Sertakan gambar</strong> untuk scatter/grid/kernel/dll
        (dirender akurat dari spek model). Progress & thinking model ditampilkan
        seperti di Simulasi.
      </p>

      <div className="flex flex-wrap gap-2">
        <ChoiceChip
          active={generationMode === "standard"}
          onClick={() => setGenerationMode("standard")}
          disabled={loading}
        >
          Standar
        </ChoiceChip>
        <ChoiceChip
          active={generationMode === "custom"}
          onClick={() => setGenerationMode("custom")}
          disabled={loading}
        >
          Custom topik
        </ChoiceChip>
        <ChoiceChip
          active={generationMode === "study-case"}
          onClick={() => setGenerationMode("study-case")}
          disabled={loading}
        >
          Studi kasus PREDIKSI
        </ChoiceChip>
      </div>

      {generationMode === "custom" ? (
        <div className="space-y-2.5">
          <textarea
            className="textarea !min-h-[88px]"
            value={topicPrompt}
            onChange={(e) =>
              setTopicPrompt(e.target.value.slice(0, TOPIC_PROMPT_MAX_LEN))
            }
            placeholder="Contoh: Fokus backpropagation & aktivasi/loss; sedikit MLP…"
            disabled={loading}
            rows={3}
          />
          <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
            {TOPIC_HINTS.map((t) => (
              <button
                key={t.id}
                type="button"
                className="btn btn-secondary !px-2.5 !py-1 text-xs"
                onClick={() => appendTopicHint(t.label)}
                disabled={loading}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="select"
              value={difficultyMode}
              onChange={(e) =>
                setDifficultyMode(e.target.value as DifficultyMode)
              }
              disabled={loading}
            >
              {DIFFICULTY_MODES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={answerType}
              onChange={(e) => setAnswerType(e.target.value)}
              disabled={loading}
            >
              {["numeric", "short_string", "mcq", "python_output"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="select"
            value={track}
            onChange={(e) => {
              const t = e.target.value as "A" | "B" | "C" | "D";
              setTrack(t);
              setTopic(TRACKS[t].topics[0]);
            }}
            disabled={loading}
          >
            {Object.entries(TRACKS).map(([id, meta]) => (
              <option key={id} value={id}>
                {id}. {meta.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={loading}
          >
            {TRACKS[track].topics.map((t) => (
              <option key={t} value={t}>
                {TOPIC_LABELS[t] ?? t}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={difficultyMode}
            onChange={(e) =>
              setDifficultyMode(e.target.value as DifficultyMode)
            }
            disabled={loading}
          >
            {DIFFICULTY_MODES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          {generationMode === "study-case" ? (
            <select
              className="select"
              value={problemCount}
              onChange={(e) => setProblemCount(Number(e.target.value))}
              disabled={loading}
            >
              {[3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} soal terkait
                </option>
              ))}
            </select>
          ) : (
            <select
              className="select"
              value={answerType}
              onChange={(e) => setAnswerType(e.target.value)}
              disabled={loading}
            >
              {["numeric", "short_string", "mcq", "python_output"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[var(--accent)]"
          checked={includeFigures}
          onChange={(e) => {
            setFiguresTouched(true);
            setIncludeFigures(e.target.checked);
          }}
          disabled={loading}
        />
        <span>
          Sertakan gambar{" "}
          <span className="text-[var(--muted)]">
            (scatter, grid, pohon, kernel, batang, tabel, graf)
          </span>
        </span>
      </label>

      <button className="btn btn-accent" onClick={generate} disabled={loading}>
        {loading
          ? "Menghasilkan…"
          : generationMode === "study-case"
            ? "Buat studi kasus"
            : generationMode === "custom"
              ? "Generate dari brief topik"
              : "Buat soal baru"}
      </button>
      {loading || (error && progress.message) ? (
        <GenerationProgressPanel state={progress} />
      ) : null}
      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
    </div>
  );
}

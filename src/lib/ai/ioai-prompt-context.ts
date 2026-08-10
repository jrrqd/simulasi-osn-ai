import "server-only";

import { getIoaiGuideByResourceId } from "@/lib/content/ioai-guides";
import { listIoaiResourcesForPrompt } from "@/lib/content/ioai-resources";
import type { IoaiResourceRecord } from "@/lib/content/resource-types";
import { TOPIC_LABELS } from "@/lib/content/types";
import {
  canAccessIoaiResources,
  loadUserPhaseAccess,
} from "@/lib/user/load-phase";
import type { Phase } from "@/lib/user/phase";

const MAX_SUMMARY_CHARS = 280;
const MAX_RINGKASAN_CHARS = 520;
const MAX_HINT_CHARS = 220;

function clip(text: string, max: number) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

function formatResourceBlock(
  resource: IoaiResourceRecord,
  ringkasan?: string,
): string {
  const topicLabels = resource.topics
    .slice(0, 4)
    .map((t) => TOPIC_LABELS[t] ?? t)
    .join(", ");
  const lines = [
    `### ${resource.title}`,
    resource.year ? `Tahun: ${resource.year}` : null,
    topicLabels ? `Topik terkait: ${topicLabels}` : null,
    `Ringkas: ${clip(resource.summary, MAX_SUMMARY_CHARS)}`,
    resource.promptHint
      ? `Hint gaya soal: ${clip(resource.promptHint, MAX_HINT_CHARS)}`
      : null,
    ringkasan
      ? `Cuplikan panduan ID:\n${clip(ringkasan, MAX_RINGKASAN_CHARS)}`
      : null,
    `Sumber: ${resource.url}`,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Phase-gated IOAI Education Hub context for LLM generation prompts.
 * Empty string when the user is pre-seleksi (non-admin) or no resources match.
 */
export async function buildIoaiKnowledgeContext(params: {
  phase: Phase;
  role?: string | null;
  topics?: string[];
  focusPrompt?: string;
  limit?: number;
  /** Include clipped Indonesian guide ringkasan when available. */
  includeGuideRingkasan?: boolean;
}): Promise<string> {
  if (!canAccessIoaiResources(params.phase, params.role)) {
    return "";
  }

  const limit = params.limit ?? 4;
  const resources = await listIoaiResourcesForPrompt({
    topics: params.topics,
    focusPrompt: params.focusPrompt,
    limit,
  });
  if (resources.length === 0) return "";

  const blocks: string[] = [];
  for (const resource of resources) {
    let ringkasan: string | undefined;
    if (params.includeGuideRingkasan !== false) {
      const guide = await getIoaiGuideByResourceId(resource.id);
      if (guide?.ringkasan?.trim()) ringkasan = guide.ringkasan;
    }
    blocks.push(formatResourceBlock(resource, ringkasan));
  }

  return `## Referensi IOAI (inspirasi gaya & kedalaman — JANGAN salin soal/dataset asli)
Gunakan cuplikan berikut hanya untuk menyesuaikan gaya studi kasus, constraint, dan metrik ke format EKKA (numeric / MCQ / codeSpec in-exam).
- Jangan minta unduh dataset / Colab / Kaggle eksternal.
- Jangan menjiplak statement resmi; buat skenario dan angka baru.
- Tetap patuhi track/topic silabus yang diminta.

${blocks.join("\n\n")}`;
}

/** Convenience for generation entrypoints that only have a userId. */
export async function buildIoaiKnowledgeContextForUser(params: {
  userId: string;
  topics?: string[];
  focusPrompt?: string;
  limit?: number;
}): Promise<string> {
  const access = await loadUserPhaseAccess(params.userId);
  return buildIoaiKnowledgeContext({
    phase: access.phase,
    role: access.role,
    topics: params.topics,
    focusPrompt: params.focusPrompt,
    limit: params.limit,
  });
}

export async function listIoaiTopicsForUser(params: {
  userId: string;
  topics?: string[];
  focusPrompt?: string;
  limit?: number;
}): Promise<string[]> {
  const access = await loadUserPhaseAccess(params.userId);
  if (!canAccessIoaiResources(access.phase, access.role)) return [];
  const resources = await listIoaiResourcesForPrompt({
    topics: params.topics,
    focusPrompt: params.focusPrompt,
    limit: params.limit ?? 6,
  });
  return [...new Set(resources.flatMap((r) => r.topics))].slice(0, 8);
}

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  extractJsonMiddleware,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { z } from "zod";
import {
  extractJsonObjectText,
  repairJsonObjectText,
} from "@/lib/ai/parse-json-object";
import {
  PREDIKSI_FEW_SHOT_SINGLE,
  PREDIKSI_STYLE_RULES,
} from "@/lib/ai/prediksi-style";
import { extractPythonStarterFromStem } from "@/lib/ai/exam-python-policy";
import {
  DEFAULT_WRITE_CLOSE,
  DEFAULT_WRITE_OPEN,
} from "@/lib/ai/code-skeleton";
import type {
  CodeSpec,
  CompetitionSpec,
  NumericFormat,
  SubmissionScoringMode,
} from "@/lib/content/types";

const answerTypeSchema = z.enum([
  "numeric",
  "short_string",
  "multi_part",
  "python_output",
  "codeSpec",
  "mcq",
  "notebook_submission",
]);

const numericFormatSchema = z.enum([
  "integer",
  "decimal",
  "space_separated",
  "comma_separated",
]);

const submissionScoringModeSchema = z.enum([
  "accuracy",
  "f1_macro",
  "rmse",
  "mae",
]);

const codeSpecTestCaseSchema = z.object({
  input: z.coerce.string().default(""),
  expectedOutput: z.coerce.string(),
  weight: z.coerce.number().optional(),
});

const codeSpecSchema = z.object({
  skeleton: z.coerce.string().min(1),
  lockedMarkers: z
    .object({
      open: z.coerce.string(),
      close: z.coerce.string(),
    })
    .optional(),
  testCases: z.array(codeSpecTestCaseSchema).min(1),
  timeLimitMs: z.coerce.number().default(2000),
  memoryLimitMb: z.coerce.number().default(256),
  forbiddenImports: z.array(z.coerce.string()).optional(),
});

const competitionFileSchema = z.object({
  name: z.coerce.string().min(1),
  description: z.coerce.string().optional(),
  content: z.coerce.string().min(1),
});

const competitionSpecSchema = z.object({
  overview: z.coerce.string().min(20),
  scoring: z.object({
    mode: submissionScoringModeSchema,
    label: z.coerce.string().optional(),
  }),
  files: z.array(competitionFileSchema).min(2),
  submission: z.object({
    idColumn: z.coerce.string().default("id"),
    targetColumn: z.coerce.string().default("prediction"),
    columns: z.array(z.coerce.string()).optional(),
  }),
  hiddenLabelsCsv: z.coerce.string().min(1),
});

export const generatedProblemSchema = z.object({
  title: z.coerce.string().min(3).max(240),
  track: z.enum(["A", "B", "C", "D"]).catch("B"),
  topic: z.coerce.string().min(1).max(64),
  difficulty: z.coerce.number().int().min(1).max(5),
  answerType: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(answerTypeSchema)
    .catch("numeric"),
  stem: z.coerce.string().min(10),
  answer: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number()])),
  ]),
  tolerance: z.coerce.number().optional(),
  choices: z.array(z.union([z.string(), z.number()])).optional(),
  solution: z.coerce.string().min(10),
  tags: z.array(z.coerce.string()).optional(),
  starterCode: z.coerce.string().optional(),
  numericFormat: numericFormatSchema.optional(),
  weight: z.coerce.number().optional(),
  codeSpec: codeSpecSchema.optional(),
  competitionSpec: competitionSpecSchema.optional(),
  /** Raw figure specs from the model; materialized after id assignment. */
  figures: z.array(z.unknown()).optional(),
  /**
   * Freeform image prompts (geometry / illustration). Materialized via
   * MiniMax image-01 into on-disk rasters; stripped before payload persist.
   */
  imagePrompts: z
    .array(
      z.object({
        id: z.coerce.string().min(1).max(32),
        alt: z.coerce.string().min(1).max(120),
        prompt: z.coerce.string().min(10).max(1500),
      }),
    )
    .optional(),
});

export type GeneratedProblemPayload = {
  title: string;
  track: "A" | "B" | "C" | "D";
  topic: string;
  difficulty: number;
  answerType:
    | "numeric"
    | "short_string"
    | "multi_part"
    | "python_output"
    | "codeSpec"
    | "mcq"
    | "notebook_submission";
  stem: string;
  answer: string | number | string[];
  tolerance?: number;
  choices?: string[];
  solution: string;
  tags?: string[];
  starterCode?: string;
  numericFormat?: NumericFormat;
  weight?: number;
  codeSpec?: CodeSpec;
  competitionSpec?: CompetitionSpec;
  figures?: unknown[];
  imagePrompts?: { id: string; alt: string; prompt: string }[];
  legacy?: boolean;
};

function normalizeCodeSpec(
  raw: z.infer<typeof codeSpecSchema> | undefined,
): CodeSpec | undefined {
  if (!raw) return undefined;
  return {
    skeleton: raw.skeleton,
    lockedMarkers: raw.lockedMarkers ?? {
      open: DEFAULT_WRITE_OPEN,
      close: DEFAULT_WRITE_CLOSE,
    },
    testCases: raw.testCases.map((c) => ({
      input: c.input ?? "",
      expectedOutput: c.expectedOutput,
      weight: c.weight,
    })),
    timeLimitMs: raw.timeLimitMs,
    memoryLimitMb: raw.memoryLimitMb,
    forbiddenImports: raw.forbiddenImports,
  };
}

function normalizeCompetitionSpec(
  raw: z.infer<typeof competitionSpecSchema> | undefined,
): CompetitionSpec | undefined {
  if (!raw) return undefined;
  const idColumn = raw.submission.idColumn || "id";
  const targetColumn = raw.submission.targetColumn || "prediction";
  return {
    overview: raw.overview,
    scoring: {
      mode: raw.scoring.mode as SubmissionScoringMode,
      label: raw.scoring.label,
    },
    files: raw.files.map((f) => ({
      name: f.name,
      description: f.description,
      content: f.content,
    })),
    submission: {
      idColumn,
      targetColumn,
      columns:
        raw.submission.columns && raw.submission.columns.length > 0
          ? raw.submission.columns
          : [idColumn, targetColumn],
    },
    hiddenLabelsCsv: raw.hiddenLabelsCsv,
  };
}

/**
 * Models (especially MiniMax-M3 for kaggle long-form) frequently emit a
 * "kaggle-style" problem with a different shape than the rest of the app:
 * - "description" instead of "stem"
 * - "codeSpec" as a string (containing Python skeleton) instead of an object
 * - "testCases", "timeLimitMs", "memoryLimitMb" hoisted to the top level
 * - missing "solution" (often fused into the description)
 *
 * Remap these to the canonical shape before Zod validation. This is a
 * pure shape-only fix — content is preserved verbatim.
 */
export function remapKaggleShape(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const obj = { ...(value as Record<string, unknown>) };

  // 1. description / prompt / problem / problemStatement / problemDescription / statement → stem
  //    (when stem is missing). Some kaggle-style outputs use description
  //    (string or object), others use prompt/problem/problemStatement/problemDescription/statement.
  //    Flatten object descriptions into a markdown stem.
  const stemSource = !obj.stem
    ? (obj.description ??
        obj.prompt ??
        obj.problem ??
        obj.problemStatement ??
        obj.problemDescription ??
        obj.statement)
    : undefined;
  if (stemSource != null && !obj.stem) {
    if (typeof stemSource === "string") {
      obj.stem = stemSource;
    } else if (typeof stemSource === "object") {
      const desc = stemSource as Record<string, unknown>;
      const parts: string[] = [];
      for (const [k, v] of Object.entries(desc)) {
        if (v == null) continue;
        if (typeof v === "string") {
          parts.push(`## ${k}\n${v}`);
        } else if (Array.isArray(v)) {
          parts.push(`## ${k}\n${JSON.stringify(v, null, 2)}`);
        } else {
          parts.push(`## ${k}\n${JSON.stringify(v, null, 2)}`);
        }
      }
      obj.stem = parts.join("\n\n");
    }
    for (const k of ["description", "prompt", "problem", "problemStatement", "problemDescription", "statement"]) {
      if (k in obj) delete obj[k];
    }
  }

  // 1b. If still no stem, synthesize one from the title + codeSpec context
  //     (some kaggle variants only emit codeSpec + testCases without a stem).
  if (typeof obj.stem !== "string" || obj.stem.length < 10) {
    const title = typeof obj.title === "string" ? obj.title : "Coding Problem";
    const cs = obj.codeSpec as Record<string, unknown> | undefined;
    const skeleton = cs && typeof cs.skeleton === "string" ? cs.skeleton : "";
    // Extract the docstring/comment block right after the function def — that's where
    // the model typically writes the problem statement.
    let annotation = "";
    if (skeleton) {
      const docMatch = skeleton.match(/"""([\s\S]*?)"""/);
      if (docMatch) {
        annotation = docMatch[1]!.trim();
      } else {
        // Fallback: take the first contiguous run of comment lines
        const lines = skeleton.split("\n");
        const buf: string[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("#") || trimmed.startsWith("//")) {
            buf.push(trimmed.replace(/^[#\/\s]+/, ""));
          } else if (buf.length > 0 && trimmed === "") {
            buf.push("");
          } else if (buf.length > 0) {
            break;
          }
        }
        annotation = buf.join("\n").trim();
      }
    }
    const tc = cs && Array.isArray(cs.testCases) ? (cs.testCases as unknown[]) : null;
    const firstTest = tc && tc[0] && typeof tc[0] === "object" ? (tc[0] as Record<string, unknown>) : null;
    const sampleInput = firstTest && typeof firstTest.input === "string" ? firstTest.input.slice(0, 240) : "";
    const sampleOutput = firstTest && typeof firstTest.expectedOutput === "string" ? firstTest.expectedOutput.slice(0, 240) : "";
    const parts = [
      `## ${title}`,
      annotation,
      `Selesaikan fungsi sesuai spesifikasi pada codeSpec. Lihat test cases di bawah untuk contoh I/O.`,
      sampleInput || sampleOutput
        ? `### Contoh I/O\n${sampleInput ? `Input:\n\`\`\`\n${sampleInput}\n\`\`\`\n` : ""}${sampleOutput ? `Output:\n\`\`\`\n${sampleOutput}\n\`\`\`\n` : ""}`
        : "",
    ].filter(Boolean);
    obj.stem = parts.join("\n\n");
  }

  // 2. flat top-level testCases / examples / timeLimitMs / memoryLimitMb
  //    → fold into codeSpec
  const hoistTestCases = Array.isArray(obj.testCases) ? obj.testCases : null;
  const hoistExamples = Array.isArray(obj.examples) ? obj.examples : null;
  const hoistTime = typeof obj.timeLimitMs === "number" ? obj.timeLimitMs : null;
  const hoistMem = typeof obj.memoryLimitMb === "number" ? obj.memoryLimitMb : null;

  // 3. codeSpec as a string → wrap into { skeleton: <string>, ...hoisted }
  //    Also normalize codeSpec.starterCode / template → codeSpec.skeleton (model variants).
  if (obj.codeSpec && typeof obj.codeSpec === "object" && !Array.isArray(obj.codeSpec)) {
    const cs = obj.codeSpec as Record<string, unknown>;
    if (typeof cs.skeleton !== "string") {
      if (typeof cs.starterCode === "string") cs.skeleton = cs.starterCode;
      else if (typeof cs.template === "string") cs.skeleton = cs.template;
    }
    delete cs.starterCode;
    delete cs.template;
  }
  if (typeof obj.codeSpec === "string" && obj.codeSpec.trim()) {
    const cs: Record<string, unknown> = { skeleton: obj.codeSpec };
    if (hoistTestCases) cs.testCases = hoistTestCases;
    else if (hoistExamples) cs.testCases = hoistExamples;
    if (hoistTime != null) cs.timeLimitMs = hoistTime;
    if (hoistMem != null) cs.memoryLimitMb = hoistMem;
    // Fallback: parser runs before we know answerType, so don't require time/mem here.
    obj.codeSpec = cs;
    if (hoistTestCases) delete obj.testCases;
    if (hoistExamples) delete obj.examples;
    if (hoistTime != null) delete obj.timeLimitMs;
    if (hoistMem != null) delete obj.memoryLimitMb;
  } else if (
    obj.codeSpec &&
    typeof obj.codeSpec === "object"
  ) {
    const cs = obj.codeSpec as Record<string, unknown>;
    // Pull testCases from top-level testCases or examples if codeSpec lacks them
    if (!Array.isArray(cs.testCases)) {
      if (hoistTestCases) {
        cs.testCases = hoistTestCases;
        delete obj.testCases;
      } else if (hoistExamples) {
        cs.testCases = hoistExamples;
        delete obj.examples;
      }
    }
    if (hoistTime != null) {
      cs.timeLimitMs = hoistTime;
      delete obj.timeLimitMs;
    }
    if (hoistMem != null) {
      cs.memoryLimitMb = hoistMem;
      delete obj.memoryLimitMb;
    }
  } else if (hoistTestCases || hoistExamples) {
    // codeSpec is missing entirely; create a stub from hoisted fields
    const cs: Record<string, unknown> = {};
    if (hoistTestCases) cs.testCases = hoistTestCases;
    else if (hoistExamples) cs.testCases = hoistExamples;
    if (hoistTime != null) cs.timeLimitMs = hoistTime;
    if (hoistMem != null) cs.memoryLimitMb = hoistMem;
    obj.codeSpec = cs;
    if (hoistTestCases) delete obj.testCases;
    if (hoistExamples) delete obj.examples;
    if (hoistTime != null) delete obj.timeLimitMs;
    if (hoistMem != null) delete obj.memoryLimitMb;
  }

  // 3b. Normalize testCases fields: model sometimes uses "output" instead of
  //     "expectedOutput", and "input" may be missing on certain variants.
  const cs = obj.codeSpec as Record<string, unknown> | undefined;
  if (cs && Array.isArray(cs.testCases)) {
    cs.testCases = (cs.testCases as unknown[]).map((tc) => {
      if (!tc || typeof tc !== "object") return tc;
      const t = { ...(tc as Record<string, unknown>) };
      if (typeof t.expectedOutput !== "string" && typeof t.output === "string") {
        t.expectedOutput = t.output;
      }
      if ("output" in t) delete t.output;
      if (typeof t.input !== "string" && typeof t.stdin === "string") {
        t.input = t.stdin;
      }
      if ("stdin" in t) delete t.stdin;
      return t;
    });
  }

  // 4. solutionSkeleton / hints → solution (when solution is missing/short)
  if (typeof obj.solution !== "string" || obj.solution.length < 10) {
    const skel = obj.solutionSkeleton;
    const hints = obj.hints;
    const parts: string[] = [];
    if (typeof skel === "string" && skel.trim()) {
      parts.push(`## Solution Skeleton\n${skel.trim()}`);
    }
    if (Array.isArray(hints) && hints.length > 0) {
      parts.push(
        `## Hints\n${hints
          .map((h) => `- ${typeof h === "string" ? h : JSON.stringify(h)}`)
          .join("\n")}`,
      );
    }
    if (parts.length > 0) {
      obj.solution = parts.join("\n\n");
    }
    if ("solutionSkeleton" in obj) delete obj.solutionSkeleton;
    if ("hints" in obj) delete obj.hints;
  } else {
    if ("solutionSkeleton" in obj) delete obj.solutionSkeleton;
    if ("hints" in obj) delete obj.hints;
  }

  // 5. Fuse answer (when missing) into a short placeholder; reuse codeSpec.testCases[0]
  if (obj.answer === undefined || obj.answer === null) {
    const cs = obj.codeSpec as Record<string, unknown> | undefined;
    const tc = Array.isArray(cs?.testCases) ? (cs.testCases as unknown[]) : null;
    if (tc && tc[0] && typeof (tc[0] as Record<string, unknown>).expectedOutput === "string") {
      obj.answer = "lihat testCases";
    } else {
      obj.answer = "ok";
    }
  }

  // 6. solution: synthesize a stub from stem if missing (the model's "solution"
  //    is often fused into the description/stem).
  if (typeof obj.solution !== "string" || obj.solution.length < 10) {
    if (typeof obj.stem === "string" && obj.stem.length >= 10) {
      obj.solution = `Lihat stem untuk ide algoritma. Implementasikan dengan cermat sesuai spec pada codeSpec.testCases.`;
    } else {
      obj.solution = "Lihat stem.";
    }
  }

  // 7. Drop known-noise fields we don't store
  for (const k of [
    "id",
    "problemId",
    "problemCode",
    "slug",
    "longFormCoding",
    "lockRanges",
    "language",
    "starterCode",
  ]) {
    if (k in obj) delete obj[k];
  }

  return obj;
}

export function normalizeGeneratedProblem(
  raw: z.infer<typeof generatedProblemSchema>,
): GeneratedProblemPayload {
  const answer = raw.answer;
  let starterCode = raw.starterCode?.trim() || undefined;
  if (
    (raw.answerType === "python_output" || raw.answerType === "codeSpec") &&
    !starterCode
  ) {
    starterCode = extractPythonStarterFromStem(raw.stem);
  }
  const codeSpec = normalizeCodeSpec(raw.codeSpec);
  const competitionSpec = normalizeCompetitionSpec(raw.competitionSpec);
  // If codeSpec present but answerType still python_output, upgrade
  let answerType = raw.answerType;
  if (codeSpec && answerType === "python_output") {
    answerType = "codeSpec";
  }
  if (competitionSpec && answerType !== "notebook_submission") {
    answerType = "notebook_submission";
  }
  return {
    ...raw,
    answerType,
    title: raw.title.trim().slice(0, 160),
    answer: Array.isArray(answer)
      ? answer.map(String)
      : typeof answer === "boolean"
        ? answer
          ? "true"
          : "false"
        : answer,
    choices: raw.choices?.map(String),
    starterCode: codeSpec?.skeleton ?? starterCode,
    numericFormat: raw.numericFormat,
    weight:
      raw.weight ??
      (answerType === "notebook_submission" || competitionSpec
        ? 5
        : answerType === "codeSpec" || codeSpec
          ? 2
          : undefined),
    codeSpec,
    competitionSpec,
    figures: raw.figures,
    imagePrompts: raw.imagePrompts?.map((p) => ({
      id: String(p.id).trim(),
      alt: String(p.alt).trim(),
      prompt: String(p.prompt).trim(),
    })),
    legacy: false,
  };
}

export function createUserProvider(params: {
  baseUrl: string;
  apiKey: string;
  modelId: string;
  /** Strip markdown fences for structured (JSON) output parsing. */
  jsonOutput?: boolean;
  /**
   * Disable thinking entirely (MiniMax-M3 only). Use for structured-output
   * tasks where the model would otherwise burn the entire token budget on
   * chain-of-thought inside reasoning_content and emit nothing to the text
   * channel (we observed 0 text out + 14k reasoning chars for kaggle
   * codeSpec problems). M2.x models ignore this and keep thinking on.
   */
  disableThinking?: boolean;
}) {
  // Re-validate at use time so settings persisted before the allowlist was
  // introduced (or edited directly in the DB) cannot trigger outbound SSRF.
  assertSafeProviderUrl(params.baseUrl);
  // MiniMax interleaves reasoning into `content` with <think> tags unless
  // reasoning_split is set, which cleanly separates it into reasoning_content.
  let isMiniMax = false;
  try {
    isMiniMax = /(^|\.)minimaxi?\.(io|com)$/.test(
      new URL(params.baseUrl).hostname.toLowerCase(),
    );
  } catch {
    // Invalid URLs fail later in the provider; no special handling here.
  }
  const provider = createOpenAICompatible({
    name: "user-provider",
    baseURL: params.baseUrl.replace(/\/$/, ""),
    apiKey: params.apiKey,
    // Keep false: MiniMax-M3 (and many OpenAI-compatible hosts) only support
    // response_format=json_object, not json_schema structured outputs.
    supportsStructuredOutputs: false,
    ...(isMiniMax && {
      transformRequestBody: (body: Record<string, unknown>) => {
        // MiniMax-M3 frequently returns unparsable payloads when
        // response_format/json_schema is requested; force plain chat JSON.
        const next: Record<string, unknown> = {
          ...body,
          reasoning_split: true,
        };
        delete next.response_format;
        if (params.disableThinking) {
          // M3: skip thinking, answer directly in the content channel.
          // M2.x: the API accepts this but keeps thinking on.
          next.thinking = { type: "disabled" };
        }
        return next;
      },
    }),
  });
  // Some reasoning models emit <think>...</think> before the answer; strip it
  // so structured output parsing and chat replies stay clean.
  const middleware = [extractReasoningMiddleware({ tagName: "think" })];
  if (params.jsonOutput) {
    // Models often wrap JSON in markdown fences or emit invalid LaTeX escapes;
    // extract + repair before the SDK's JSON.parse.
    middleware.push(
      extractJsonMiddleware({
        transform: (text) => {
          const extracted = extractJsonObjectText(text);
          if (!extracted) return text.trim();
          return repairJsonObjectText(extracted);
        },
      }),
    );
  }
  return wrapLanguageModel({
    model: provider.chatModel(params.modelId),
    middleware,
  });
}

/**
 * Known OpenAI-compatible provider hosts. A leading dot allows subdomains
 * (".example.com" matches "api.example.com" but not "example.com.evil.io").
 * Extend via AI_PROVIDER_HOST_ALLOWLIST (comma-separated hosts).
 */
const DEFAULT_PROVIDER_HOST_ALLOWLIST = [
  "api.minimax.io",
  "api.minimaxi.com",
  "api.openai.com",
  "api.anthropic.com",
  "openrouter.ai",
  "api.groq.com",
  "api.deepseek.com",
  "api.mistral.ai",
  "api.together.xyz",
  "api.fireworks.ai",
  "api.cerebras.ai",
  "generativelanguage.googleapis.com",
];

function isAllowedProviderHost(host: string, allowlist: string[]) {
  return allowlist.some((entry) =>
    entry.startsWith(".")
      ? host.endsWith(entry) || host === entry.slice(1)
      : host === entry,
  );
}

function isLocalOrPrivateHost(host: string) {
  // Strip IPv6 brackets for comparison.
  const h = host.replace(/^\[|\]$/g, "");
  if (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal")
  ) {
    return true;
  }
  // IPv6 loopback / link-local / unique-local / IPv4-mapped.
  if (h.includes(":")) {
    const v6 = h.toLowerCase();
    if (
      v6 === "::" ||
      v6 === "::1" ||
      v6.startsWith("fe8") ||
      v6.startsWith("fe9") ||
      v6.startsWith("fea") ||
      v6.startsWith("feb") ||
      v6.startsWith("fc") ||
      v6.startsWith("fd") ||
      v6.startsWith("::ffff:")
    ) {
      return true;
    }
  }
  // IPv4 loopback / RFC1918 / link-local & metadata / unspecified / CGNAT.
  if (
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h) ||
    /^0\./.test(h) ||
    h === "0.0.0.0"
  ) {
    return true;
  }
  return false;
}

export function assertSafeProviderUrl(baseUrl: string) {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("Base URL tidak valid");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Base URL harus http(s)");
  }

  const allowLocal = process.env.ALLOW_LOCAL_AI_PROVIDER === "true";
  const host = url.hostname.toLowerCase();

  // Local/self-hosted models (Ollama, LM Studio, …) only with explicit opt-in.
  if (allowLocal && isLocalOrPrivateHost(host)) {
    return url.toString().replace(/\/$/, "");
  }

  // Everything else must be a known provider domain over HTTPS. An exact-host
  // allowlist neutralizes SSRF vectors the old blocklist missed: metadata /
  // link-local ranges, alternate IP encodings, IPv6 forms, DNS rebinding, and
  // redirects to private addresses (we only ever talk to trusted providers).
  const allowlist = [
    ...DEFAULT_PROVIDER_HOST_ALLOWLIST,
    ...(process.env.AI_PROVIDER_HOST_ALLOWLIST ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  ];
  if (!isAllowedProviderHost(host, allowlist)) {
    throw new Error(
      "Base URL harus berasal dari provider yang diizinkan " +
        "(mis. api.minimax.io, api.openai.com, openrouter.ai). " +
        "Admin dapat menambah domain via AI_PROVIDER_HOST_ALLOWLIST.",
    );
  }
  if (url.protocol !== "https:") {
    throw new Error("Base URL provider harus HTTPS");
  }

  return url.toString().replace(/\/$/, "");
}

export const GENERATION_SYSTEM_PROMPT = `Kamu adalah pembuat soal olimpiade AI (EKKA / IOAI Indonesia) untuk siswa SMA/SMK, bergaya studi kasus PREDIKSI.

Aturan silabus (WAJIB):
- Soal HARUS hanya menguji konsep pada track/topic yang diminta.
- Gunakan materi referensi silabus yang diberikan sebagai acuan utama (definisi, rumus, contoh, tingkat kedalaman).
- Jika ada blok "Referensi kompetisi IOAI", gunakan HANYA sebagai inspirasi format/kedalaman kompetisi internasional — JANGAN menyalin soal, dataset, atau jawaban dari sumber tersebut.
- Jangan membawa konsep di luar topic tersebut kecuali sebagai prasyarat sangat dasar yang sudah disebut di materi.
- Jangan buat soal yang butuh library/API/topik di luar cakupan SMA/SMK olimpiade AI pada modul tersebut.
- Tingkat kesulitan harus sesuai angka difficulty, tetap dalam lingkup materi silabus.

${PREDIKSI_STYLE_RULES}

Kualitas soal:
- Buat soal cerita yang menuntut pemahaman konsep, bukan hafalan.
- Jawaban harus deterministik dan bisa dinilai otomatis.
- Tulis stem dan solusi dalam Bahasa Indonesia.
- Untuk numeric: WAJIB isi "numericFormat" (integer|decimal|space_separated|comma_separated). Jawaban harus PERSIS sesuai format (contoh integer: "25" BUKAN "25.0").
- Untuk mcq, sediakan choices dan answer harus SALINAN PERSIS (karakter demi karakter) salah satu string di choices.
- Untuk codeSpec: WAJIB isi codeSpec (skeleton + marker WRITE HERE/END + ≥3 testCases + timeLimitMs + memoryLimitMb), weight=2.
- Konteks matematika non-SMA (eigenvalue, softmax, attention, IoU, mAP, cross-entropy, dll): tulis 1–3 kalimat definisi/rumus di awal stem.
- Solusi harus menjelaskan langkah demi langkah secara detail, merujuk konsep dari materi silabus.

PENTING: Balas HANYA dengan satu objek JSON SOAL (bukan JSON Schema), tanpa teks lain, tanpa markdown fence, tanpa penjelasan.
- JANGAN mengembalikan skema/schema/$schema/properties/definitions. Kembalikan INSTANCE soal.
- Jika model mendukung thinking, thinking boleh ada, tetapi jawaban akhir WAJIB objek JSON soal di output utama.
- Rumus: boleh KaTeX $...$ / $$...$$ ATAU plain text ("1/2", "x^2", "P(A|B)"). Di JSON, escape backslash ganda untuk perintah LaTeX (\\\\dfrac).
- Di dalam string JSON, hindari tanda kutip ganda; untuk kode/contoh pakai kutip tunggal.
- Escape newline sebagai \\n. Jangan trailing comma. Jangan komentar.
- Solusi cukup 3–8 kalimat; jangan terlalu panjang.
- Tambahkan tag "prediksi-style" jika memakai pola studi kasus.
- Field opsional figures / imagePrompts: lihat aturan gambar di atas; gunakan {{fig:id}} di stem.

${PREDIKSI_FEW_SHOT_SINGLE}
`;

export const REVIEW_SYSTEM_PROMPT = `Kamu adalah tutor AI untuk siswa yang sedang mereview soal EKKA/OSN AI.
Jawab dalam Bahasa Indonesia yang jelas dan pedagogis.
Gunakan konteks soal, jawaban siswa, dan solusi resmi.
Jangan memberikan jawaban untuk soal lain di luar konteks.
Dorong pemahaman: jelaskan mengapa, bukan hanya apa.`;

export const STUDY_ASSISTANT_SYSTEM_PROMPT = `Kamu adalah asisten belajar untuk siswa SMA/SMK yang sedang mempelajari modul silabus EKKA / OSN AI.
Jawab dalam Bahasa Indonesia yang jelas, ringkas, dan pedagogis.
Bantu siswa memahami materi modul: jelaskan konsep, beri analogi, contoh, dan langkah berpikir.
Utamakan materi/konteks modul yang diberikan. Jika siswa bertanya di luar topik, arahkan kembali ke silabus.
Dorong pemahaman: jelaskan mengapa, bukan hanya hafalan.
Jangan membuat soal ujian lengkap kecuali diminta sebagai latihan singkat.
Jangan mengarang fakta; jika tidak yakin, katakan demikian.`;

export const ADMIN_ASSISTANT_SYSTEM_PROMPT = `Kamu adalah asisten admin untuk platform Simulasi OSN AI / EKKA.
Jawab dalam Bahasa Indonesia yang jelas, ringkas, dan berbasis data.
Gunakan snapshot aktivitas platform DAN deskripsi halaman yang sedang dibuka admin.
Jika data tidak cukup, katakan demikian — jangan mengarang angka.
Bantu admin:
- memahami perilaku siswa (aktivitas, akurasi, topik lemah, mock, siapa perlu perhatian);
- memahami konteks halaman saat ini (modul, soal, simulasi, laporan user, pengaturan);
- menavigasi/fitur platform (apa arti halaman ini, langkah berikutnya yang masuk akal).
Untuk soal yang sedang dibuka: admin boleh melihat kunci/solusi; jelaskan dengan jelas.
Jangan membocorkan password atau API key. Email siswa boleh disebut karena ini konteks admin.
Jika ditanya hal di luar data platform, jawab singkat lalu arahkan kembali ke analisis / halaman terkait.`;

export const PERFORMANCE_ASSISTANT_SYSTEM_PROMPT = `Kamu adalah konselor performa untuk siswa SMA/SMK yang sedang menyiapkan seleksi EKKA / OSN AI.
Jawab dalam Bahasa Indonesia yang hangat, jelas, ringkas, dan berbasis data performa siswa di konteks.
Gunakan HANYA data performa yang diberikan. Jika data kurang, katakan demikian — jangan mengarang skor.
Bantu siswa memahami kesiapan OSN AI, skor mock, mastery topik, dan gap prioritas.
Berikan saran actionable: topik mana yang dilatih dulu, apakah perlu mock lagi, cara memperbaiki tren skor.
Dorong motivasi tanpa menekan; fokus pada langkah konkret berikutnya.
Jangan memberikan kunci jawaban soal spesifik; arahkan ke modul belajar / latihan / simulasi di platform.`;

export const PRACTICE_ASSISTANT_SYSTEM_PROMPT = `Kamu adalah asisten latihan (side quest coach) untuk siswa SMA/SMK yang sedang mengerjakan soal di platform Simulasi OSN AI / EKKA.
Jawab dalam Bahasa Indonesia yang jelas, ringkas, dan pedagogis.
Gunakan konteks halaman latihan yang diberikan (daftar soal / filter / soal yang sedang dibuka).
Bantu siswa memahami konsep terkait, memilih strategi, dan menyusun langkah berpikir.
JANGAN memberikan jawaban akhir, kunci numerik, pilihan MCQ yang benar, atau solusi lengkap soal yang sedang dikerjakan.
Berikan petunjuk bertahap (scaffolding): pertanyaan pemandu, konsep yang relevan, kesalahan umum — biarkan siswa menyelesaikan sendiri.
Jika siswa meminta spoiler langsung, tolak dengan lembut dan tawarkan hint berjenjang.
Jika di halaman daftar (bukan soal spesifik), bantu memilih side quest / topik / cara generate tantangan.
Jangan mengarang fakta; jika tidak yakin, katakan demikian.`;


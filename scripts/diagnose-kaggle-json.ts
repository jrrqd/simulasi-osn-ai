/**
 * Verify the kaggle fix: with disableThinking=true, the model should put
 * the JSON in the text channel instead of filling reasoning.
 */
import { streamText } from "ai";
import {
  createUserProvider,
  generatedProblemSchema,
  normalizeGeneratedProblem,
  remapKaggleShape,
} from "../src/lib/ai/provider";
import { parseGeneratedProblemJson, parseJsonObject } from "../src/lib/ai/parse-json-object";

async function runOne(
  model: ReturnType<typeof createUserProvider>,
  topic: string,
  iter: number,
) {
  const system =
    "Kamu adalah pembuat soal olimpiade AI (EKKA / IOAI Indonesia).\n" +
    "Balas HANYA satu objek JSON SOAL, tanpa markdown fence, tanpa penjelasan.";

  const userPrompt = `Buat SATU soal Kaggle-style codeSpec (coding marathon).

Track: B
Topic: ${topic}
Difficulty: 3
AnswerType: codeSpec
longFormCoding: true

Instruksi:
- WAJIB isi "codeSpec" skeleton berisi marker "# >>> WRITE HERE <<<" … "# <<< END <<<".
- WAJIB ≥ 5 testCases {input, expectedOutput}.
- WAJIB timeLimitMs (500–10000) dan memoryLimitMb (64–1024).
- weight = 5.

Balas HANYA satu objek JSON SOAL.`;

  const result = streamText({
    model,
    system,
    prompt: userPrompt,
    maxOutputTokens: 8000,
    temperature: 0.4,
  });

  let text = "";
  let reasoning = "";
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") text += part.text;
    else if (part.type === "reasoning-delta") reasoning += part.text;
  }
  const finalText = (text || (await result.text)).trim();

  let parseOk = false;
  let parseError = "";
  let parsedDump = "";
  let rawError = "";
  const rawTextHead = finalText.slice(0, 300);
  const rawTextTail = finalText.slice(-300);
  try {
    const rawParsed = parseJsonObject(finalText);
    if (rawParsed && typeof rawParsed === "object" && !Array.isArray(rawParsed)) {
      parsedDump = JSON.stringify(Object.keys(rawParsed as object));
    } else if (Array.isArray(rawParsed)) {
      parsedDump = `array(${rawParsed.length})`;
    } else if (rawParsed === null) {
      parsedDump = "null";
    } else {
      parsedDump = typeof rawParsed;
    }
    const parsed = parseGeneratedProblemJson(finalText, reasoning, finalText);
    const remapped = remapKaggleShape(parsed) as Record<string, unknown>;
    // Mirror generate-problem.ts: fall back to the requested topic/track if missing
    if (!remapped.topic) remapped.topic = topic;
    if (!remapped.track) remapped.track = "B";
    const normalized = normalizeGeneratedProblem(
      generatedProblemSchema.parse(remapped),
    );
    parseOk = Boolean(normalized.stem && normalized.solution);
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
  }
  // Capture raw parseJsonObject outcome separately (it's also in the try above;
  // this just guarantees we have parsedDump and rawError even if shape-check throws)
  try {
    const rawParsed = parseJsonObject(finalText);
    if (rawParsed && typeof rawParsed === "object" && !Array.isArray(rawParsed)) {
      const keys = Object.keys(rawParsed as object);
      const sample: Record<string, string> = {};
      for (const k of keys) {
        const v = (rawParsed as Record<string, unknown>)[k];
        if (typeof v === "string") sample[k] = `string(${v.length})`;
        else if (typeof v === "number") sample[k] = `number`;
        else if (typeof v === "boolean") sample[k] = `boolean`;
        else if (Array.isArray(v)) sample[k] = `array(${v.length})`;
        else if (v && typeof v === "object") sample[k] = `object`;
        else sample[k] = typeof v;
      }
      parsedDump = JSON.stringify(sample);
      // Also dump a sub-sample of any nested testCases if present
      const cs = (rawParsed as Record<string, unknown>).codeSpec;
      if (cs && typeof cs === "object") {
        const csKeys = Object.keys(cs as object);
        const csSample: Record<string, string> = {};
        for (const k of csKeys) {
          const v = (cs as Record<string, unknown>)[k];
          if (typeof v === "string") csSample[k] = `string(${v.length})`;
          else if (Array.isArray(v)) csSample[k] = `array(${v.length})`;
          else if (v && typeof v === "object") csSample[k] = `object`;
          else csSample[k] = typeof v;
        }
        parsedDump += ` | codeSpec: ${JSON.stringify(csSample)}`;
      }
    } else if (Array.isArray(rawParsed)) {
      parsedDump = `array(${rawParsed.length})`;
    } else if (rawParsed === null) {
      parsedDump = "null";
    } else {
      parsedDump = typeof rawParsed;
    }
  } catch (err) {
    rawError = err instanceof Error ? err.message : String(err);
  }

  return {
    iter,
    topic,
    textLen: text.length,
    reasoningLen: reasoning.length,
    parseOk,
    parseError,
    parsedDump,
    rawError,
    rawTextHead,
    rawTextTail,
    rawText: finalText,
  };
}

async function main() {
  const baseUrl = process.env.MINIMAX_BASE_URL ?? "https://api.minimax.io/v1";
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY required");
  }
  const model = createUserProvider({
    baseUrl,
    apiKey,
    modelId: process.env.MINIMAX_MODEL_ID ?? "MiniMax-M3",
    jsonOutput: false,
    disableThinking: true,
  });

  const topics = [
    "pohon-keputusan",
    "ensemble",
    "svm",
    "cnn-arsitektur",
    "aljabar-linier-lanjut",
  ];

  let okCount = 0;
  for (let i = 0; i < 5; i++) {
    const topic = topics[i % topics.length]!;
    const r = await runOne(model, topic, i + 1);
    if (r.parseOk) okCount++;
    console.log(
      `[${r.iter}] topic=${r.topic} text=${r.textLen} reasoning=${r.reasoningLen} parseOk=${r.parseOk}`,
    );
    if (!r.parseOk) {
      console.log(`  err: ${r.parseError.slice(0, 200)}`);
      console.log(`  keys: ${r.parsedDump}`);
      console.log(`  rawErr: ${r.rawError.slice(0, 200)}`);
      console.log(`  rawHead: ${r.rawTextHead}`);
      console.log(`  rawTail: ${r.rawTextTail}`);
      console.log(`  >>> FULL TEXT <<<`);
      console.log(r.rawText);
      console.log(`  >>> END FULL TEXT <<<`);
    }
  }
  console.log(`\n=== ${okCount}/5 passed ===`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});

/**
 * Extract and repair a JSON object from model text.
 * MiniMax often emits near-JSON with LaTeX backslashes, raw newlines,
 * trailing commas, or truncated closing braces.
 */

export function extractJsonObjectText(text: string): string | null {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();

  const start = trimmed.indexOf("{");
  if (start === -1) return null;

  // Prefer balanced extraction; fall back to last "}" for truncated payloads.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }

  const end = trimmed.lastIndexOf("}");
  if (end > start) return trimmed.slice(start, end + 1);
  return trimmed.slice(start);
}

function isHex(ch: string | undefined) {
  return typeof ch === "string" && /[0-9a-fA-F]/.test(ch);
}

/**
 * Walk JSON text and fix common LLM mistakes inside string literals:
 * - raw control characters / newlines
 * - LaTeX-like escapes that collide with JSON (\frac, \begin, \(, \), …)
 * Keeps real JSON escapes: \", \\, \/, \n, \r, \t, \uXXXX
 * Treats \b and \f as literal backslash (almost never intentional; breaks \begin/\frac).
 */
function escapeInvalidStringEscapes(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i]!;
    const code = ch.charCodeAt(0);

    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }

    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      const next = json[i + 1];
      if (
        next === '"' ||
        next === "\\" ||
        next === "/" ||
        next === "n" ||
        next === "r" ||
        next === "t"
      ) {
        out += ch;
        escaped = true;
        continue;
      }
      if (
        next === "u" &&
        isHex(json[i + 2]) &&
        isHex(json[i + 3]) &&
        isHex(json[i + 4]) &&
        isHex(json[i + 5])
      ) {
        out += ch;
        escaped = true;
        continue;
      }
      // \b / \f / \( / \frac / etc. → keep as literal backslash
      out += "\\\\";
      continue;
    }

    if (ch === '"') {
      inString = false;
      out += ch;
      continue;
    }

    // Raw controls inside strings are invalid JSON
    if (code <= 0x1f) {
      if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "\\r";
      else if (ch === "\t") out += "\\t";
      else out += `\\u${code.toString(16).padStart(4, "0")}`;
      continue;
    }

    out += ch;
  }

  return out;
}

function stripTrailingCommas(json: string): string {
  return json.replace(/,\s*([}\]])/g, "$1");
}

/** Close open strings / braces / brackets when the model truncated output. */
export function closeTruncatedJson(text: string): string {
  let inString = false;
  let escaped = false;
  const stack: Array<"{" | "["> = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") stack.pop();
  }

  let out = text;
  if (inString) out += '"';
  while (stack.length > 0) {
    out += stack.pop() === "{" ? "}" : "]";
  }
  return out;
}

export function repairJsonObjectText(text: string): string {
  return stripTrailingCommas(escapeInvalidStringEscapes(text));
}

/** True when the model echoed a JSON Schema instead of a problem instance. */
export function looksLikeJsonSchema(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  if ("$schema" in obj || "$defs" in obj || "definitions" in obj) return true;
  if (obj.type === "object" && obj.properties && typeof obj.properties === "object") {
    const props = obj.properties as Record<string, unknown>;
    // Schema for our problem shape mentions these as nested property defs.
    if ("stem" in props && "answerType" in props && !("stem" in obj)) return true;
  }
  return false;
}

export function isGeneratedProblemShape(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.title === "string" &&
    typeof obj.stem === "string" &&
    typeof obj.solution === "string" &&
    ("answer" in obj || "choices" in obj)
  );
}

/** Study-case pack: shared preamble + linked problems[]. */
export function isStudyCaseShape(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  const problems = obj.problems;
  if (!Array.isArray(problems) || problems.length < 2) return false;
  const hasTitle =
    typeof obj.caseTitle === "string" ||
    typeof obj.title === "string" ||
    typeof obj.case_title === "string";
  const hasPreamble =
    typeof obj.preamble === "string" ||
    typeof obj.context === "string" ||
    typeof obj.sharedContext === "string";
  return hasTitle && hasPreamble;
}

function parseShapedJson(
  shapeCheck: (value: unknown) => boolean,
  shapeError: string,
  ...blobs: Array<string | undefined | null>
): unknown {
  const seen = new Set<string>();
  let lastError: unknown = new SyntaxError("No JSON object found in model response");

  for (const blob of blobs) {
    const text = blob?.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);

    try {
      const parsed = parseJsonObject(text);
      if (looksLikeJsonSchema(parsed)) {
        lastError = new SyntaxError(
          "Model mengembalikan JSON Schema, bukan objek soal",
        );
        continue;
      }
      if (!shapeCheck(parsed)) {
        lastError = new SyntaxError(shapeError);
        continue;
      }
      return parsed;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new SyntaxError("Could not parse JSON object from model response");
}

/**
 * Try several raw model blobs (answer text, reasoning, combined) and return the
 * first JSON object that looks like a generated problem — never a JSON Schema.
 */
export function parseGeneratedProblemJson(
  ...blobs: Array<string | undefined | null>
): unknown {
  return parseShapedJson(
    isGeneratedProblemShape,
    "JSON terparse tetapi bukan objek soal (title/stem/solution)",
    ...blobs,
  );
}

/**
 * Parse a study-case JSON pack ({ caseTitle, preamble, problems[] }).
 * Must not use parseGeneratedProblemJson — that requires stem/answer at root.
 */
export function parseStudyCaseJson(
  ...blobs: Array<string | undefined | null>
): unknown {
  return parseShapedJson(
    isStudyCaseShape,
    "JSON terparse tetapi bukan studi kasus (caseTitle/preamble/problems)",
    ...blobs,
  );
}

export function parseJsonObject(text: string): unknown {
  const extracted = extractJsonObjectText(text);
  if (!extracted) {
    throw new SyntaxError("No JSON object found in model response");
  }

  const candidates = [
    repairJsonObjectText(extracted),
    repairJsonObjectText(closeTruncatedJson(extracted)),
    extracted,
    closeTruncatedJson(extracted),
  ];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new SyntaxError("Could not parse JSON object from model response");
}

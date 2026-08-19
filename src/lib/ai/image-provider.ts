/**
 * MiniMax image-01 client (native /v1/image_generation).
 * Shares BYOK / admin / env credentials with the chat provider via callers.
 */

import { assertSafeProviderUrl } from "@/lib/ai/provider";

export const DEFAULT_IMAGE_MODEL_ID = "image-01";

export type ImageAspectRatio =
  | "1:1"
  | "16:9"
  | "4:3"
  | "3:2"
  | "2:3"
  | "3:4"
  | "9:16"
  | "21:9";

export type GenerateImageParams = {
  prompt: string;
  baseUrl: string;
  apiKey: string;
  /** Defaults to MINIMAX_IMAGE_MODEL_ID or image-01. */
  modelId?: string;
  aspectRatio?: ImageAspectRatio;
  n?: number;
  /** Prefer base64 so we can persist without a second network hop. */
  responseFormat?: "url" | "base64";
  signal?: AbortSignal;
};

export type GeneratedImage = {
  /** Remote URL when response_format=url. */
  url?: string;
  /** Raw base64 (no data: prefix) when response_format=base64. */
  base64?: string;
};

type MiniMaxImageResponse = {
  data?: {
    image_urls?: string[];
    image_base64?: string[];
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
};

function resolveImageBaseUrl(chatBaseUrl: string): string {
  const override = process.env.MINIMAX_IMAGE_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return chatBaseUrl.replace(/\/$/, "");
}

export function resolveImageModelId(explicit?: string): string {
  return (
    explicit?.trim() ||
    process.env.MINIMAX_IMAGE_MODEL_ID?.trim() ||
    DEFAULT_IMAGE_MODEL_ID
  );
}

/**
 * Generate one image via MiniMax image-01.
 * Throws on API / auth / content-safety errors.
 */
export async function generateImage(
  params: GenerateImageParams,
): Promise<GeneratedImage> {
  const prompt = params.prompt.trim().slice(0, 1500);
  if (prompt.length < 10) {
    throw new Error("Prompt gambar terlalu pendek");
  }

  // Same SSRF guard as chat: only allowlisted provider hosts may be fetched.
  const baseUrl = assertSafeProviderUrl(resolveImageBaseUrl(params.baseUrl));
  const model = resolveImageModelId(params.modelId);
  const responseFormat = params.responseFormat ?? "base64";
  const n = Math.min(9, Math.max(1, params.n ?? 1));

  const res = await fetch(`${baseUrl}/image_generation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      aspect_ratio: params.aspectRatio ?? "1:1",
      response_format: responseFormat,
      n,
      prompt_optimizer: false,
    }),
    signal: params.signal ?? AbortSignal.timeout(60_000),
  });

  const bodyText = await res.text();
  let json: MiniMaxImageResponse;
  try {
    json = JSON.parse(bodyText) as MiniMaxImageResponse;
  } catch {
    throw new Error(
      `MiniMax image API mengembalikan non-JSON (HTTP ${res.status})`,
    );
  }

  const statusCode = json.base_resp?.status_code;
  if (typeof statusCode === "number" && statusCode !== 0) {
    const msg = json.base_resp?.status_msg?.trim() || `status ${statusCode}`;
    throw new Error(`MiniMax image gagal: ${msg}`);
  }

  if (!res.ok) {
    throw new Error(
      `MiniMax image HTTP ${res.status}: ${json.base_resp?.status_msg ?? bodyText.slice(0, 200)}`,
    );
  }

  if (responseFormat === "base64") {
    const b64 = json.data?.image_base64?.[0];
    if (!b64?.trim()) {
      throw new Error("MiniMax image tidak mengembalikan base64");
    }
    return { base64: b64.trim() };
  }

  const url = json.data?.image_urls?.[0];
  if (!url?.trim()) {
    throw new Error("MiniMax image tidak mengembalikan URL");
  }
  return { url: url.trim() };
}

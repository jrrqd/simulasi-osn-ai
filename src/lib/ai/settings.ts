import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  aiProviderSettings,
  systemAiProviderSettings,
} from "@/db/schema";
import { decryptSecret } from "@/lib/crypto/secrets";

export const DEFAULT_AI_BASE_URL = "https://api.minimax.io/v1";
export const DEFAULT_AI_MODEL_ID = "MiniMax-M3";

function getDefaultAiSettings() {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    source: "default" as const,
    baseUrl: process.env.MINIMAX_BASE_URL?.trim() || DEFAULT_AI_BASE_URL,
    modelId: process.env.MINIMAX_MODEL_ID?.trim() || DEFAULT_AI_MODEL_ID,
    apiKey,
  };
}

export async function getEffectiveAiSettings(userId: string) {
  const db = await getDb();
  const personal = await db.query.aiProviderSettings.findFirst({
    where: eq(aiProviderSettings.userId, userId),
  });

  if (personal?.lastTestOk) {
    return {
      source: "personal" as const,
      baseUrl: personal.baseUrl,
      modelId: personal.modelId,
      apiKey: decryptSecret({
        ciphertext: personal.apiKeyCiphertext,
        iv: personal.apiKeyIv,
        tag: personal.apiKeyTag,
      }),
    };
  }

  const shared = await db.query.systemAiProviderSettings.findFirst({
    where: eq(systemAiProviderSettings.id, "default"),
  });
  if (shared?.enabled && shared.lastTestOk) {
    return {
      source: "admin" as const,
      baseUrl: shared.baseUrl,
      modelId: shared.modelId,
      apiKey: decryptSecret({
        ciphertext: shared.apiKeyCiphertext,
        iv: shared.apiKeyIv,
        tag: shared.apiKeyTag,
      }),
    };
  }

  return getDefaultAiSettings();
}

export async function getAiAvailability(userId: string) {
  const db = await getDb();
  const personal = await db.query.aiProviderSettings.findFirst({
    where: eq(aiProviderSettings.userId, userId),
  });
  const shared = await db.query.systemAiProviderSettings.findFirst({
    where: eq(systemAiProviderSettings.id, "default"),
  });
  const fallback = getDefaultAiSettings();
  return {
    personalConfigured: Boolean(personal),
    personalReady: Boolean(personal?.lastTestOk),
    sharedAvailable: Boolean(
      (shared?.enabled && shared.lastTestOk) || fallback,
    ),
    effectiveSource: personal?.lastTestOk
      ? ("personal" as const)
      : shared?.enabled && shared.lastTestOk
        ? ("admin" as const)
        : fallback
          ? ("default" as const)
          : null,
  };
}

import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { generateText } from "ai";
import { getDb } from "@/db";
import { systemAiProviderSettings } from "@/db/schema";
import { requireApiAdmin, rateLimit } from "@/lib/api";
import {
  assertSafeProviderUrl,
  createUserProvider,
} from "@/lib/ai/provider";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";

export async function GET(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const db = await getDb();
  const row = await db.query.systemAiProviderSettings.findFirst({
    where: eq(systemAiProviderSettings.id, "default"),
  });
  if (!row) return Response.json({ configured: false, enabled: false });

  return Response.json({
    configured: true,
    enabled: row.enabled,
    baseUrl: row.baseUrl,
    modelId: row.modelId,
    apiKeyMasked: "••••••••",
    lastTestedAt: row.lastTestedAt,
    lastTestOk: row.lastTestOk,
  });
}

export async function PUT(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-ai:${authResult.user.id}`, 30)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const baseUrl = assertSafeProviderUrl(String(body.baseUrl ?? ""));
  const modelId = String(body.modelId ?? "").trim();
  const apiKey = String(body.apiKey ?? "").trim();
  const enabled = body.enabled !== false;
  if (!modelId) {
    return Response.json({ error: "Model wajib diisi" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.query.systemAiProviderSettings.findFirst({
    where: eq(systemAiProviderSettings.id, "default"),
  });
  if (!apiKey && !existing) {
    return Response.json({ error: "API key wajib diisi" }, { status: 400 });
  }

  const encrypted = apiKey
    ? encryptSecret(apiKey)
    : {
        ciphertext: existing!.apiKeyCiphertext,
        iv: existing!.apiKeyIv,
        tag: existing!.apiKeyTag,
      };

  await db
    .insert(systemAiProviderSettings)
    .values({
      id: "default",
      baseUrl,
      modelId,
      apiKeyCiphertext: encrypted.ciphertext,
      apiKeyIv: encrypted.iv,
      apiKeyTag: encrypted.tag,
      enabled,
      updatedBy: authResult.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemAiProviderSettings.id,
      set: {
        baseUrl,
        modelId,
        apiKeyCiphertext: encrypted.ciphertext,
        apiKeyIv: encrypted.iv,
        apiKeyTag: encrypted.tag,
        enabled,
        updatedBy: authResult.user.id,
        updatedAt: new Date(),
      },
    });

  return Response.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`admin-ai-test:${authResult.user.id}`, 10)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const db = await getDb();
  const row = await db.query.systemAiProviderSettings.findFirst({
    where: eq(systemAiProviderSettings.id, "default"),
  });
  if (!row) {
    return Response.json({ error: "Konfigurasi belum disimpan" }, { status: 400 });
  }

  try {
    const apiKey = decryptSecret({
      ciphertext: row.apiKeyCiphertext,
      iv: row.apiKeyIv,
      tag: row.apiKeyTag,
    });
    const model = createUserProvider({
      baseUrl: row.baseUrl,
      apiKey,
      modelId: row.modelId,
    });
    await generateText({
      model,
      prompt: "Balas dengan tepat satu kata: OK",
      maxOutputTokens: 8,
      abortSignal: AbortSignal.timeout(20_000),
    });
    await db
      .update(systemAiProviderSettings)
      .set({ lastTestedAt: new Date(), lastTestOk: true })
      .where(eq(systemAiProviderSettings.id, "default"));
    return Response.json({ ok: true });
  } catch (error) {
    await db
      .update(systemAiProviderSettings)
      .set({ lastTestedAt: new Date(), lastTestOk: false })
      .where(eq(systemAiProviderSettings.id, "default"));
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Gagal menguji koneksi",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireApiAdmin(req);
  if ("error" in authResult) return authResult.error;

  const db = await getDb();
  await db
    .delete(systemAiProviderSettings)
    .where(eq(systemAiProviderSettings.id, "default"));
  return Response.json({ ok: true });
}

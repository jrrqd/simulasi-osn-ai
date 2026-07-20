import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { aiProviderSettings } from "@/db/schema";
import { requireApiUser, rateLimit } from "@/lib/api";
import {
  assertSafeProviderUrl,
  createUserProvider,
} from "@/lib/ai/provider";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto/secrets";
import { getAiAvailability } from "@/lib/ai/settings";
import { generateText } from "ai";

export async function GET(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  const db = await getDb();
  const row = await db.query.aiProviderSettings.findFirst({
    where: eq(aiProviderSettings.userId, authResult.user.id),
  });
  const availability = await getAiAvailability(authResult.user.id);
  if (!row) {
    return Response.json({ configured: false, ...availability });
  }
  return Response.json({
    configured: true,
    baseUrl: row.baseUrl,
    modelId: row.modelId,
    hasApiKey: true,
    apiKeyMasked: "••••••••",
    lastTestedAt: row.lastTestedAt,
    lastTestOk: row.lastTestOk,
    ...availability,
  });
}

export async function PUT(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`settings:${authResult.user.id}`, 30)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const body = await req.json();
  const baseUrl = assertSafeProviderUrl(String(body.baseUrl ?? ""));
  const modelId = String(body.modelId ?? "").trim();
  const apiKey = String(body.apiKey ?? "").trim();
  if (!modelId) {
    return Response.json({ error: "Model wajib diisi" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.query.aiProviderSettings.findFirst({
    where: eq(aiProviderSettings.userId, authResult.user.id),
  });

  if (!apiKey && !existing) {
    return Response.json({ error: "API key wajib diisi" }, { status: 400 });
  }

  const enc = apiKey
    ? encryptSecret(apiKey)
    : {
        ciphertext: existing!.apiKeyCiphertext,
        iv: existing!.apiKeyIv,
        tag: existing!.apiKeyTag,
      };

  if (existing) {
    await db
      .update(aiProviderSettings)
      .set({
        baseUrl,
        modelId,
        apiKeyCiphertext: enc.ciphertext,
        apiKeyIv: enc.iv,
        apiKeyTag: enc.tag,
        updatedAt: new Date(),
      })
      .where(eq(aiProviderSettings.id, existing.id));
  } else {
    await db.insert(aiProviderSettings).values({
      id: nanoid(),
      userId: authResult.user.id,
      baseUrl,
      modelId,
      apiKeyCiphertext: enc.ciphertext,
      apiKeyIv: enc.iv,
      apiKeyTag: enc.tag,
    });
  }

  return Response.json({
    ok: true,
    apiKeyMasked: apiKey ? maskSecret(apiKey) : "••••••••",
  });
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  const db = await getDb();
  await db
    .delete(aiProviderSettings)
    .where(eq(aiProviderSettings.userId, authResult.user.id));
  return Response.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;
  if (!rateLimit(`settings-test:${authResult.user.id}`, 10)) {
    return Response.json({ error: "Terlalu banyak permintaan" }, { status: 429 });
  }

  const db = await getDb();
  const row = await db.query.aiProviderSettings.findFirst({
    where: eq(aiProviderSettings.userId, authResult.user.id),
  });
  if (!row) {
    return Response.json({ error: "Belum ada konfigurasi" }, { status: 400 });
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
      abortSignal: AbortSignal.timeout(20000),
    });
    await db
      .update(aiProviderSettings)
      .set({ lastTestedAt: new Date(), lastTestOk: true })
      .where(eq(aiProviderSettings.id, row.id));
    return Response.json({ ok: true });
  } catch (e) {
    await db
      .update(aiProviderSettings)
      .set({ lastTestedAt: new Date(), lastTestOk: false })
      .where(eq(aiProviderSettings.id, row.id));
    return Response.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Gagal menguji koneksi",
      },
      { status: 400 },
    );
  }
}

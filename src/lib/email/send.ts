import { Resend } from "resend";

const DEFAULT_FROM = "Simulasi OSN AI <noreply@radr.nxtdev.xyz>";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

/**
 * Send a transactional email via Resend. Returns false when skipped
 * (missing API key) or on provider failure — callers should not crash auth.
 */
export async function sendTransactionalEmail(
  input: SendEmailInput,
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const client = getResendClient();
  if (!client) {
    console.warn(
      "[email] RESEND_API_KEY missing — skipped send:",
      input.subject,
      "→",
      input.to,
    );
    return { ok: false, error: "RESEND_API_KEY not configured", skipped: true };
  }

  try {
    const result = await client.emails.send({
      from: getEmailFrom(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (result.error) {
      console.error("[email] Resend error:", result.error);
      return { ok: false, error: result.error.message };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email send failed";
    console.error("[email] send failed:", message);
    return { ok: false, error: message };
  }
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1c2430;max-width:560px;margin:0 auto;padding:24px">
  <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
  ${bodyHtml}
  <p style="margin-top:28px;font-size:12px;color:#667085">Simulasi OSN AI · https://radr.nxtdev.xyz/simosnai</p>
</body></html>`;
}

export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
}): Promise<void> {
  const name = params.name || "teman";
  void sendTransactionalEmail({
    to: params.to,
    subject: "Selamat datang di Simulasi OSN AI",
    html: wrapHtml(
      "Selamat datang!",
      `<p>Hai ${escapeHtml(name)},</p>
       <p>Akunmu sudah siap. Mulai dari Belajar, Latihan, atau Simulasi — dan manfaatkan asisten AI (kuota 5 chat/hari untuk akun gratis).</p>
       <p><a href="https://radr.nxtdev.xyz/simosnai/study">Buka aplikasi</a></p>`,
    ),
    text: `Hai ${name}, selamat datang di Simulasi OSN AI. Buka https://radr.nxtdev.xyz/simosnai/study`,
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  url: string;
}): Promise<void> {
  void sendTransactionalEmail({
    to: params.to,
    subject: "Atur ulang password Simulasi OSN AI",
    html: wrapHtml(
      "Atur ulang password",
      `<p>Hai ${escapeHtml(params.name || "")},</p>
       <p>Kami menerima permintaan reset password. Klik tombol di bawah (berlaku terbatas):</p>
       <p><a href="${escapeHtml(params.url)}" style="display:inline-block;background:#0f6e56;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Reset password</a></p>
       <p style="font-size:13px;color:#667085">Jika kamu tidak meminta ini, abaikan email ini.</p>`,
    ),
    text: `Reset password: ${params.url}`,
  });
}

export async function sendVipConfirmationEmail(params: {
  to: string;
  name: string;
  vipExpiresAt: Date;
}): Promise<void> {
  const until = params.vipExpiresAt.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "long",
    timeStyle: "short",
  });
  void sendTransactionalEmail({
    to: params.to,
    subject: "VIP aktif — Simulasi OSN AI",
    html: wrapHtml(
      "VIP aktif",
      `<p>Hai ${escapeHtml(params.name || "")},</p>
       <p>Pembayaran Trakteer berhasil. Keanggotaan VIP aktif sampai <strong>${escapeHtml(until)} WIB</strong>.</p>
       <p>Asisten AI sekarang tanpa batas kuota harian.</p>
       <p><a href="https://radr.nxtdev.xyz/simosnai/settings/upgrade">Lihat status VIP</a></p>`,
    ),
    text: `VIP aktif sampai ${until} WIB. Lihat https://radr.nxtdev.xyz/simosnai/settings/upgrade`,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

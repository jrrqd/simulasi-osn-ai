import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey() {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)",
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptSecret(parts: {
  ciphertext: string;
  iv: string;
  tag: string;
}) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(parts.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(parts.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parts.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskSecret(secret: string) {
  if (secret.length <= 8) return "••••••••";
  return `${secret.slice(0, 3)}••••${secret.slice(-4)}`;
}

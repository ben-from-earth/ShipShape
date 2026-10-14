import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * 32-byte AES key from `TENANT_SECRET_KEY`.
 * Accepts standard base64, or 64 hex characters.
 */
export function tenantSecretKey(): Buffer {
  const raw = process.env.TENANT_SECRET_KEY?.trim();
  if (!raw) {
    throw new Error("TENANT_SECRET_KEY is not set.");
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) {
    return decoded;
  }

  throw new Error("TENANT_SECRET_KEY must decode to 32 bytes.");
}

/** AES-256-GCM payload: base64 iv, tag, and ciphertext, separated by `.`. */
export function encryptDatabaseUrl(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, tenantSecretKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64")).join(".");
}

export function decryptDatabaseUrl(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Tenant database URL payload is invalid.");
  }
  const [ivPart, tagPart, dataPart] = parts;
  if (ivPart === undefined || tagPart === undefined || dataPart === undefined) {
    throw new Error("Tenant database URL payload is invalid.");
  }
  const iv = Buffer.from(ivPart, "base64");
  const tag = Buffer.from(tagPart, "base64");
  const data = Buffer.from(dataPart, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || data.length === 0) {
    throw new Error("Tenant database URL payload is invalid.");
  }

  const decipher = createDecipheriv(ALGORITHM, tenantSecretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

import crypto from "node:crypto";
import { config } from "../config";

const ALGO = "aes-256-gcm";

/**
 * Ma'lumotni AES-256-GCM bilan shifrlaydi. Har bir yozuv uchun tasodifiy IV
 * ishlatiladi, natija "iv:authTag:ciphertext" (hex) ko'rinishida qaytariladi.
 */
export function encryptField(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, config.encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptField(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(":");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Shifrlangan yozuv formati noto'g'ri");
  }
  const decipher = crypto.createDecipheriv(ALGO, config.encryptionKey, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/** Ikkilik fayl (PDF/rasm) ma'lumotini shifrlaydi: [iv(12)][authTag(16)][ciphertext] */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, config.encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptBuffer(payload: Buffer): Buffer {
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, config.encryptionKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/** Loglarda xavfsiz ko'rsatish uchun qiymatning faqat oxirgi belgilarini qoldiradi. */
export function maskForLog(value: string, visibleTail = 4): string {
  if (value.length <= visibleTail) return "*".repeat(value.length);
  return "*".repeat(value.length - visibleTail) + value.slice(-visibleTail);
}

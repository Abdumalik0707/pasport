import "dotenv/config";
import crypto from "node:crypto";

const isProd = process.env.NODE_ENV === "production";

// Ishlab chiqish (development) muhitida shifrlash kaliti berilmagan bo'lsa,
// jarayon davomida vaqtinchalik kalit generatsiya qilamiz (server qayta ishga
// tushganda eski shifrlangan yozuvlar o'qilmay qoladi — shu sababli production'da
// DATA_ENCRYPTION_KEY albatta .env orqali berilishi SHART).
const encryptionKeyHex =
  process.env.DATA_ENCRYPTION_KEY ??
  (isProd
    ? (() => {
        throw new Error("DATA_ENCRYPTION_KEY production muhitida majburiy.");
      })()
    : crypto.randomBytes(32).toString("hex"));

if (!/^[0-9a-fA-F]{64}$/.test(encryptionKeyHex)) {
  throw new Error("DATA_ENCRYPTION_KEY 32 baytli (64 ta hex belgidan iborat) qiymat bo'lishi kerak.");
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 3000),
  publicOrigin: process.env.PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3000}`,
  encryptionKey: Buffer.from(encryptionKeyHex, "hex"),
  db: {
    path: process.env.DB_PATH ?? "data/submissions.db",
  },
  rateLimit: {
    windowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES ?? 15),
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 5),
  },
  bitrix: {
    webhookUrl: process.env.BITRIX_WEBHOOK_URL ?? "",
    leadSourceId: process.env.BITRIX_LEAD_SOURCE_ID ?? "WEB",
    assignedById: process.env.BITRIX_ASSIGNED_BY_ID ?? "",
    fields: {
      birthDate: process.env.BITRIX_FIELD_BIRTH_DATE ?? "",
      citizenship: process.env.BITRIX_FIELD_CITIZENSHIP ?? "",
      officialAddress: process.env.BITRIX_FIELD_ADDRESS ?? "",
      telegramUsername: process.env.BITRIX_FIELD_TELEGRAM ?? "",
      domesticPassportNumber: process.env.BITRIX_FIELD_DOMESTIC_PASSPORT_NUMBER ?? "",
      domesticPinfl: process.env.BITRIX_FIELD_DOMESTIC_PINFL ?? "",
      internationalPassportNumber: process.env.BITRIX_FIELD_INTL_PASSPORT_NUMBER ?? "",
      internationalPinfl: process.env.BITRIX_FIELD_INTL_PINFL ?? "",
      fatherFullName: process.env.BITRIX_FIELD_FATHER_NAME ?? "",
      fatherPhone: process.env.BITRIX_FIELD_FATHER_PHONE ?? "",
      motherFullName: process.env.BITRIX_FIELD_MOTHER_NAME ?? "",
      motherPhone: process.env.BITRIX_FIELD_MOTHER_PHONE ?? "",
    },
    fileFields: {
      photo3x4: process.env.BITRIX_FIELD_FILE_PHOTO ?? "",
      passportScan: process.env.BITRIX_FIELD_FILE_PASSPORT_SCAN ?? "",
      diploma: process.env.BITRIX_FIELD_FILE_DIPLOMA ?? "",
      transcript: process.env.BITRIX_FIELD_FILE_TRANSCRIPT ?? "",
    },
  },
};

export function assertBitrixConfigured(): void {
  if (!config.bitrix.webhookUrl) {
    // eslint-disable-next-line no-console
    console.warn(
      "[OGOHLANTIRISH] BITRIX_WEBHOOK_URL sozlanmagan. Arizalar faqat mahalliy bazaga saqlanadi va Bitrix24'ga yuborilmaydi."
    );
  }
}

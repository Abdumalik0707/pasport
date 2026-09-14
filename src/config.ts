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
  adminPanel: {
    apiUrl: process.env.ADMIN_API_URL ?? "",
    apiKey: process.env.ADMIN_API_KEY ?? "",
    // Admin panel multipart so'rovda kutayotgan fayl maydon nomlari
    fileFieldNames: {
      photo3x4: process.env.ADMIN_API_FILE_FIELD_PHOTO ?? "photo",
      passportScan: process.env.ADMIN_API_FILE_FIELD_PASSPORT_SCAN ?? "passport_scan",
      diploma: process.env.ADMIN_API_FILE_FIELD_DIPLOMA ?? "diploma",
      transcript: process.env.ADMIN_API_FILE_FIELD_TRANSCRIPT ?? "transcript",
    },
  },
  bitrix: {
    webhookUrl: process.env.BITRIX_WEBHOOK_URL ?? "",
    leadSourceId: process.env.BITRIX_LEAD_SOURCE_ID ?? "WEB",
    assignedById: process.env.BITRIX_ASSIGNED_BY_ID ?? "",
    // "Pasport ma'lumotlari" voronkasi (CATEGORY_ID) va "Yangi lid" bosqichi (STAGE_ID)
    dealCategoryId: Number(process.env.BITRIX_DEAL_CATEGORY_ID ?? 1),
    dealNewStageId: process.env.BITRIX_DEAL_NEW_STAGE_ID ?? "C1:NEW",
    // Sdelka (Deal) entitisida forma savollariga mos qilib yaratilgan maxsus maydon kodlari.
    dealFields: {
      birthDate: process.env.BITRIX_DEAL_FIELD_BIRTH_DATE ?? "",
      citizenship: process.env.BITRIX_DEAL_FIELD_CITIZENSHIP ?? "",
      officialAddress: process.env.BITRIX_DEAL_FIELD_ADDRESS ?? "",
      telegramUsername: process.env.BITRIX_DEAL_FIELD_TELEGRAM ?? "",
      domesticPassportNumber: process.env.BITRIX_DEAL_FIELD_DOMESTIC_PASSPORT_NUMBER ?? "",
      domesticPinfl: process.env.BITRIX_DEAL_FIELD_DOMESTIC_PINFL ?? "",
      internationalPassportNumber: process.env.BITRIX_DEAL_FIELD_INTL_PASSPORT_NUMBER ?? "",
      internationalPinfl: process.env.BITRIX_DEAL_FIELD_INTL_PINFL ?? "",
      fatherFullName: process.env.BITRIX_DEAL_FIELD_FATHER_NAME ?? "",
      fatherPhone: process.env.BITRIX_DEAL_FIELD_FATHER_PHONE ?? "",
      motherFullName: process.env.BITRIX_DEAL_FIELD_MOTHER_NAME ?? "",
      motherPhone: process.env.BITRIX_DEAL_FIELD_MOTHER_PHONE ?? "",
    },
    // Sdelka'da ochilgan "Fayl" turidagi maxsus maydon kodlari
    dealFileFields: {
      photo3x4: process.env.BITRIX_DEAL_FIELD_FILE_PHOTO ?? "",
      passportScan: process.env.BITRIX_DEAL_FIELD_FILE_PASSPORT_SCAN ?? "",
      diploma: process.env.BITRIX_DEAL_FIELD_FILE_DIPLOMA ?? "",
      transcript: process.env.BITRIX_DEAL_FIELD_FILE_TRANSCRIPT ?? "",
    },
  },
};

export function assertIntegrationsConfigured(): void {
  if (!config.adminPanel.apiUrl || !config.adminPanel.apiKey) {
    // eslint-disable-next-line no-console
    console.warn(
      "[OGOHLANTIRISH] ADMIN_API_URL yoki ADMIN_API_KEY sozlanmagan. Arizalar admin panelga yuborilmaydi (mahalliy bazada saqlanib qoladi)."
    );
  }
  if (!config.bitrix.webhookUrl) {
    // eslint-disable-next-line no-console
    console.warn(
      "[OGOHLANTIRISH] BITRIX_WEBHOOK_URL sozlanmagan. Arizalar Bitrix24'ga yuborilmaydi (mahalliy bazada saqlanib qoladi)."
    );
  }
}

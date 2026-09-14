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
};

export function assertAdminPanelConfigured(): void {
  if (!config.adminPanel.apiUrl || !config.adminPanel.apiKey) {
    // eslint-disable-next-line no-console
    console.warn(
      "[OGOHLANTIRISH] ADMIN_API_URL yoki ADMIN_API_KEY sozlanmagan. Arizalar faqat mahalliy bazaga saqlanadi va admin panelga yuborilmaydi."
    );
  }
}

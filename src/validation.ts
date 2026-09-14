import { z } from "zod";

// O'zbekiston biometrik pasporti: 2 ta lotin harfi + 7 ta raqam (masalan AA1234567)
const PASSPORT_SERIES_NUMBER_RE = /^[A-Z]{2}\d{7}$/;
// JSHSHIR (PINFL): 14 ta raqam
const PINFL_RE = /^\d{14}$/;
// Bir yoki bir nechta telefon raqami, vergul bilan ajratilgan (masalan "+998901234567, +996700123456").
// Mamlakat kodini foydalanuvchi o'zi kiritadi, shuning uchun qattiq +998 formati talab qilinmaydi.
const MULTI_PHONE_RE = /^\+?\d{7,15}(,\s*\+?\d{7,15})*$/;
const NAME_RE = /^[A-Za-zА-Яа-яЎўҚқҒғҲҳʻʼ'’\-\s]{2,60}$/u;
const FULL_NAME_RE = /^[A-Za-zА-Яа-яЎўҚқҒғҲҳʻʼ'’\-\s]{5,160}$/u;
const TELEGRAM_RE = /^@?[A-Za-z0-9_]{5,32}$/;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD formatida bo'lishi kerak")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Sana noto'g'ri");

export const applicationSchema = z
  .object({
    // Shaxsiy ma'lumotlar
    firstName: z.string().trim().regex(NAME_RE, "Ism noto'g'ri kiritildi"),
    lastName: z.string().trim().regex(NAME_RE, "Familiya noto'g'ri kiritildi"),
    patronymic: z.string().trim().regex(NAME_RE, "Otangizning ismi noto'g'ri kiritildi"),
    birthDate: isoDate,
    citizenship: z.string().trim().min(2).max(60).default("O'zbekiston"),
    officialAddress: z.string().trim().min(5).max(200),

    // Aloqa ma'lumotlari (bir nechta raqam vergul bilan ajratilgan holda kelishi mumkin)
    phone: z.string().trim().regex(MULTI_PHONE_RE, "Telefon raqamni to'g'ri kiriting (7-15 ta raqam)"),
    telegramUsername: z
      .string()
      .trim()
      .regex(TELEGRAM_RE, "Telegram foydalanuvchi nomi noto'g'ri (masalan @username)")
      .transform((value) => (value.startsWith("@") ? value : `@${value}`)),

    // Pasport ma'lumotlari
    domesticPassportNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(PASSPORT_SERIES_NUMBER_RE, "Pasport raqami AA1234567 ko'rinishida bo'lishi kerak"),
    domesticPinfl: z.string().trim().regex(PINFL_RE, "JSHSHIR 14 ta raqamdan iborat bo'lishi kerak"),
    internationalPassportNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(PASSPORT_SERIES_NUMBER_RE, "Pasport raqami AA1234567 ko'rinishida bo'lishi kerak")
      .optional()
      .or(z.literal("")),
    internationalPinfl: z
      .string()
      .trim()
      .regex(PINFL_RE, "JSHSHIR 14 ta raqamdan iborat bo'lishi kerak")
      .optional()
      .or(z.literal("")),

    // Ota-ona ma'lumotlari
    fatherFullName: z.string().trim().regex(FULL_NAME_RE, "To'liq ism-familiya noto'g'ri kiritildi"),
    fatherPhone: z.string().trim().regex(MULTI_PHONE_RE, "Telefon raqamni to'g'ri kiriting (7-15 ta raqam)"),
    motherFullName: z.string().trim().regex(FULL_NAME_RE, "To'liq ism-familiya noto'g'ri kiritildi"),
    motherPhone: z.string().trim().regex(MULTI_PHONE_RE, "Telefon raqamni to'g'ri kiriting (7-15 ta raqam)"),

    // Bot-himoya: foydalanuvchiga ko'rinmaydigan maydon bo'sh kelishi kerak
    website: z.string().max(0, "Bot aniqlandi").optional().or(z.literal("")),
  })
  .refine((data) => Date.parse(data.birthDate) < Date.now(), {
    message: "Tug'ilgan sana noto'g'ri",
    path: ["birthDate"],
  });

export type ApplicationInput = z.infer<typeof applicationSchema>;

export const DOCUMENT_FIELDS = ["photo3x4", "passportScan", "diploma", "transcript"] as const;
export type DocumentFieldName = (typeof DOCUMENT_FIELDS)[number];

export const DOCUMENT_FIELD_LABELS: Record<DocumentFieldName, string> = {
  photo3x4: "3x4 rasm",
  passportScan: "Pasport skani",
  diploma: "Diplom",
  transcript: "Transkript",
};

export const DOCUMENT_FIELD_RULES: Record<DocumentFieldName, { mimeTypes: string[]; maxSizeBytes: number }> = {
  photo3x4: { mimeTypes: ["image/jpeg", "image/png", "application/pdf"], maxSizeBytes: 5 * 1024 * 1024 },
  passportScan: { mimeTypes: ["application/pdf"], maxSizeBytes: 10 * 1024 * 1024 },
  diploma: { mimeTypes: ["application/pdf"], maxSizeBytes: 10 * 1024 * 1024 },
  transcript: { mimeTypes: ["application/pdf"], maxSizeBytes: 10 * 1024 * 1024 },
};

/** Har bir hujjat turi uchun bir martada yuklash mumkin bo'lgan fayllar soni. */
export const MAX_FILES_PER_FIELD = 5;

import { config } from "../config";
import type { ApplicationInput, DocumentFieldName } from "../validation";

interface BitrixAddDealResponse {
  result?: number;
  error?: string;
  error_description?: string;
}

export interface BitrixFileAttachment {
  fieldName: DocumentFieldName;
  originalFilename: string;
  buffer: Buffer;
}

// Bitrix24'dagi "Fuqaroligingiz" enumeratsiya maydoni qiymatlari ID'lari
// (crm.deal.fields orqali olingan, UF_CRM_1789392308).
const CITIZENSHIP_ENUM_IDS: Record<string, string> = {
  "O'zbekiston": "855",
  "Qozog'iston": "857",
  "Qirg'iziston": "859",
  Tojikiston: "861",
  Turkmaniston: "863",
  Turkiya: "865",
};

function buildComment(data: ApplicationInput, fileCount: number): string {
  const lines = [
    `F.I.Sh: ${data.lastName} ${data.firstName} ${data.patronymic}`.trim(),
    `Tug'ilgan sana: ${data.birthDate}`,
    `Fuqaroligi: ${data.citizenship}`,
    `Rasmiy manzil: ${data.officialAddress}`,
    `Telefon: ${data.phone}`,
    `Telegram: ${data.telegramUsername}`,
    `Oddiy pasport: ${data.domesticPassportNumber}`,
    `Oddiy pasport JSHSHIR: ${data.domesticPinfl}`,
    data.internationalPassportNumber ? `Zagran pasport: ${data.internationalPassportNumber}` : "",
    data.internationalPinfl ? `Zagran JSHSHIR: ${data.internationalPinfl}` : "",
    `Ota F.I.Sh: ${data.fatherFullName}`,
    `Ota telefon: ${data.fatherPhone}`,
    `Ona F.I.Sh: ${data.motherFullName}`,
    `Ona telefon: ${data.motherPhone}`,
    fileCount ? `Ilova qilingan hujjatlar soni: ${fileCount} (server bazasida shifrlangan holda saqlanadi)` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function buildDealFields(data: ApplicationInput, files: BitrixFileAttachment[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    TITLE: `Ariza: ${data.lastName} ${data.firstName}`,
    CATEGORY_ID: config.bitrix.dealCategoryId,
    STAGE_ID: config.bitrix.dealNewStageId,
    SOURCE_ID: config.bitrix.leadSourceId,
    COMMENTS: buildComment(data, files.length),
  };

  if (config.bitrix.assignedById) {
    fields.ASSIGNED_BY_ID = config.bitrix.assignedById;
  }

  const f = config.bitrix.dealFields;
  if (f.birthDate) fields[f.birthDate] = data.birthDate;
  if (f.citizenship) fields[f.citizenship] = CITIZENSHIP_ENUM_IDS[data.citizenship] ?? data.citizenship;
  if (f.officialAddress) fields[f.officialAddress] = data.officialAddress;
  if (f.telegramUsername) fields[f.telegramUsername] = data.telegramUsername;
  if (f.domesticPassportNumber) fields[f.domesticPassportNumber] = data.domesticPassportNumber;
  if (f.domesticPinfl) fields[f.domesticPinfl] = data.domesticPinfl;
  if (f.internationalPassportNumber && data.internationalPassportNumber) {
    fields[f.internationalPassportNumber] = data.internationalPassportNumber;
  }
  if (f.internationalPinfl && data.internationalPinfl) {
    fields[f.internationalPinfl] = data.internationalPinfl;
  }
  if (f.fatherFullName) fields[f.fatherFullName] = data.fatherFullName;
  if (f.fatherPhone) fields[f.fatherPhone] = data.fatherPhone;
  if (f.motherFullName) fields[f.motherFullName] = data.motherFullName;
  if (f.motherPhone) fields[f.motherPhone] = data.motherPhone;

  // Sdelka'dagi fayl maydonlari bitta qiymatli (isMultiple: false) va Bitrix24
  // ularni faqat { fileData: [nom, base64] } ko'rinishida qabul qiladi (oddiy
  // [nom, base64] massivi jim tarzda e'tiborga olinmaydi). Bir xil turga bir
  // nechta fayl yuklangan bo'lsa, faqat birinchisi Bitrix'ga boriladi — barcha
  // fayllar baribir server bazasida va (sozlangan bo'lsa) admin panelda saqlanadi.
  const seenFields = new Set<DocumentFieldName>();
  for (const file of files) {
    if (seenFields.has(file.fieldName)) continue;
    seenFields.add(file.fieldName);
    const fileFieldCode = config.bitrix.dealFileFields[file.fieldName];
    if (!fileFieldCode) continue;
    fields[fileFieldCode] = { fileData: [file.originalFilename, file.buffer.toString("base64")] };
  }

  return fields;
}

export class BitrixNotConfiguredError extends Error {
  constructor() {
    super("Bitrix24 webhook manzili sozlanmagan (BITRIX_WEBHOOK_URL)");
    this.name = "BitrixNotConfiguredError";
  }
}

/**
 * Bitrix24'da "Pasport ma'lumotlari" voronkasida "Yangi lid" bosqichida yangi
 * sdelka (deal) yaratadi (hujjatlar bilan birga). Muvaffaqiyatli bo'lsa sdelka
 * ID'sini qaytaradi.
 */
export async function pushDealToBitrix(
  data: ApplicationInput,
  files: BitrixFileAttachment[] = []
): Promise<string> {
  if (!config.bitrix.webhookUrl) {
    throw new BitrixNotConfiguredError();
  }

  const url = new URL("crm.deal.add.json", config.bitrix.webhookUrl.replace(/\/?$/, "/"));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: buildDealFields(data, files), params: { REGISTER_SONET_EVENT: "Y" } }),
      signal: controller.signal,
    });

    const body = (await response.json()) as BitrixAddDealResponse;

    if (!response.ok || body.error) {
      throw new Error(body.error_description || body.error || `HTTP ${response.status}`);
    }
    if (!body.result) {
      throw new Error("Bitrix24 sdelka ID qaytarmadi");
    }
    return String(body.result);
  } finally {
    clearTimeout(timeout);
  }
}

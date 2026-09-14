import { config } from "../config";
import type { ApplicationInput, DocumentFieldName } from "../validation";

interface BitrixAddLeadResponse {
  result?: number;
  error?: string;
  error_description?: string;
}

export interface BitrixFileAttachment {
  fieldName: DocumentFieldName;
  originalFilename: string;
  buffer: Buffer;
}

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

function buildLeadFields(
  data: ApplicationInput,
  files: BitrixFileAttachment[]
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    TITLE: `Ariza: ${data.lastName} ${data.firstName}`,
    NAME: data.firstName,
    LAST_NAME: data.lastName,
    SECOND_NAME: data.patronymic,
    SOURCE_ID: config.bitrix.leadSourceId,
    COMMENTS: buildComment(data, files.length),
    PHONE: data.phone.split(",").map((value) => ({ VALUE: value.trim(), VALUE_TYPE: "WORK" })),
  };

  if (config.bitrix.assignedById) {
    fields.ASSIGNED_BY_ID = config.bitrix.assignedById;
  }

  const f = config.bitrix.fields;
  if (f.birthDate) fields[f.birthDate] = data.birthDate;
  if (f.citizenship) fields[f.citizenship] = data.citizenship;
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

  // Bir xil hujjat turiga (masalan diplom) bir nechta fayl yuklangan bo'lishi mumkin —
  // Bitrix24'ga guruhlab, ko'p qiymatli "Fayl" maydoni sifatida yuboriladi.
  const filesByField = new Map<DocumentFieldName, BitrixFileAttachment[]>();
  for (const file of files) {
    const group = filesByField.get(file.fieldName) ?? [];
    group.push(file);
    filesByField.set(file.fieldName, group);
  }
  for (const [fieldName, group] of filesByField) {
    const fileFieldCode = config.bitrix.fileFields[fieldName];
    if (!fileFieldCode) continue;
    const values = group.map((file) => [file.originalFilename, file.buffer.toString("base64")]);
    fields[fileFieldCode] = values.length === 1 ? values[0] : values;
  }

  return fields;
}

export class BitrixNotConfiguredError extends Error {
  constructor() {
    super("Bitrix24 webhook manzili sozlanmagan (BITRIX_WEBHOOK_URL)");
    this.name = "BitrixNotConfiguredError";
  }
}

/** Bitrix24'ga yangi lead yaratadi (hujjatlar bilan birga). Muvaffaqiyatli bo'lsa lead ID qaytaradi. */
export async function pushLeadToBitrix(
  data: ApplicationInput,
  files: BitrixFileAttachment[] = []
): Promise<string> {
  if (!config.bitrix.webhookUrl) {
    throw new BitrixNotConfiguredError();
  }

  const url = new URL("crm.lead.add.json", config.bitrix.webhookUrl.replace(/\/?$/, "/"));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: buildLeadFields(data, files), params: { REGISTER_SONET_EVENT: "Y" } }),
      signal: controller.signal,
    });

    const body = (await response.json()) as BitrixAddLeadResponse;

    if (!response.ok || body.error) {
      throw new Error(body.error_description || body.error || `HTTP ${response.status}`);
    }
    if (!body.result) {
      throw new Error("Bitrix24 lead ID qaytarmadi");
    }
    return String(body.result);
  } finally {
    clearTimeout(timeout);
  }
}

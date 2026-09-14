import { config } from "../config";
import type { ApplicationInput, DocumentFieldName } from "../validation";

export interface AdminPanelFileAttachment {
  fieldName: DocumentFieldName;
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
}

interface AdminPanelResponse {
  success?: boolean;
  id?: string | number;
  error?: string;
}

export class AdminPanelNotConfiguredError extends Error {
  constructor() {
    super("Admin panel sozlanmagan (ADMIN_API_URL / ADMIN_API_KEY)");
    this.name = "AdminPanelNotConfiguredError";
  }
}

function buildComment(data: ApplicationInput): string {
  const lines = [
    `Otasining ismi: ${data.patronymic}`,
    `Fuqaroligi: ${data.citizenship}`,
    `Telegram: ${data.telegramUsername}`,
    data.internationalPassportNumber ? `Zagran pasport: ${data.internationalPassportNumber}` : "",
    data.internationalPinfl ? `Zagran JSHSHIR: ${data.internationalPinfl}` : "",
    `Ota F.I.Sh: ${data.fatherFullName}`,
    `Ota telefon: ${data.fatherPhone}`,
    `Ona F.I.Sh: ${data.motherFullName}`,
    `Ona telefon: ${data.motherPhone}`,
  ];
  return lines.filter(Boolean).join("\n");
}

function buildFields(data: ApplicationInput): Record<string, string> {
  // Admin panel API talab qilgan asosiy maydonlar (nomlari o'zgarmasligi kerak)
  const passportSeries = data.domesticPassportNumber.slice(0, 2);
  const passportNumber = data.domesticPassportNumber.slice(2);

  const fields: Record<string, string> = {
    full_name: `${data.lastName} ${data.firstName} ${data.patronymic}`.trim(),
    birth_date: data.birthDate,
    passport_series: passportSeries,
    passport_number: passportNumber,
    pinfl: data.domesticPinfl,
    phone: data.phone,
    address: data.officialAddress,
    comment: buildComment(data),
    // Qo'shimcha maydonlar — admin panel tomonidan avtomatik saqlanadi
    citizenship: data.citizenship,
    telegram: data.telegramUsername,
    father_full_name: data.fatherFullName,
    father_phone: data.fatherPhone,
    mother_full_name: data.motherFullName,
    mother_phone: data.motherPhone,
  };

  if (data.internationalPassportNumber) {
    fields.international_passport_number = data.internationalPassportNumber;
  }
  if (data.internationalPinfl) {
    fields.international_pinfl = data.internationalPinfl;
  }

  return fields;
}

/** Ariza va unga biriktirilgan hujjatlarni admin panel API'siga yuboradi. */
export async function submitToAdminPanel(
  data: ApplicationInput,
  files: AdminPanelFileAttachment[]
): Promise<string> {
  if (!config.adminPanel.apiUrl || !config.adminPanel.apiKey) {
    throw new AdminPanelNotConfiguredError();
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(buildFields(data))) {
    formData.append(key, value);
  }
  for (const file of files) {
    const fieldName = config.adminPanel.fileFieldNames[file.fieldName];
    formData.append(fieldName, new Blob([file.buffer], { type: file.mimeType }), file.originalFilename);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(config.adminPanel.apiUrl, {
      method: "POST",
      headers: { "x-api-key": config.adminPanel.apiKey },
      body: formData,
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => ({}))) as AdminPanelResponse;

    if (!response.ok || body.success === false) {
      throw new Error(body.error || `HTTP ${response.status}`);
    }
    return body.id !== undefined ? String(body.id) : "ok";
  } finally {
    clearTimeout(timeout);
  }
}

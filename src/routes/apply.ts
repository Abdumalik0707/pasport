import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import {
  applicationSchema,
  DOCUMENT_FIELDS,
  DOCUMENT_FIELD_LABELS,
  DOCUMENT_FIELD_RULES,
  MAX_FILES_PER_FIELD,
  type DocumentFieldName,
} from "../validation";
import {
  saveSubmission,
  saveSubmissionFile,
  markBitrixSent,
  markBitrixFailed,
  markAdminSent,
  markAdminFailed,
  hashIp,
} from "../db";
import { submitToAdminPanel, AdminPanelNotConfiguredError, type AdminPanelFileAttachment } from "../services/adminPanel";
import { pushDealToBitrix, BitrixNotConfiguredError, type BitrixFileAttachment } from "../services/bitrix";
import { markInFlight, clearInFlight } from "../services/inFlight";
import { logger } from "../logger";
import { maskForLog } from "../services/crypto";

export const applyRouter = Router();

const MAX_FILE_SIZE = 10 * 1024 * 1024; // eng kattasiga mos umumiy chegara, aniq chegara pastda tekshiriladi

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: DOCUMENT_FIELDS.length * MAX_FILES_PER_FIELD },
}).fields(DOCUMENT_FIELDS.map((name) => ({ name, maxCount: MAX_FILES_PER_FIELD })));

function handleUpload(req: Request, res: Response, next: NextFunction): void {
  upload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({ ok: false, error: `Fayl yuklashda xatolik: ${err.message}` });
      return;
    }
    if (err) {
      res.status(400).json({ ok: false, error: "Fayl yuklashda xatolik yuz berdi" });
      return;
    }
    next();
  });
}

applyRouter.post("/submit", handleUpload, async (req, res) => {
  const parsed = applicationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: "Ma'lumotlarda xatolik bor",
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  if (parsed.data.website) {
    logger.warn({ ip: req.ip }, "Honeypot ishga tushdi, so'rov e'tiborga olinmadi");
    res.json({ ok: true });
    return;
  }

  const filesByField = (req.files as Record<string, Express.Multer.File[]> | undefined) ?? {};
  const fieldErrors: Record<string, string[]> = {};
  const validFiles: { fieldName: DocumentFieldName; file: Express.Multer.File }[] = [];

  for (const fieldName of DOCUMENT_FIELDS) {
    const files = filesByField[fieldName] ?? [];
    if (files.length === 0) {
      fieldErrors[fieldName] = [`${DOCUMENT_FIELD_LABELS[fieldName]} fayli talab qilinadi`];
      continue;
    }
    const rules = DOCUMENT_FIELD_RULES[fieldName];
    const badFile = files.find(
      (file) => !rules.mimeTypes.includes(file.mimetype) || file.size > rules.maxSizeBytes
    );
    if (badFile) {
      const message = !rules.mimeTypes.includes(badFile.mimetype)
        ? `${DOCUMENT_FIELD_LABELS[fieldName]} uchun fayl turi noto'g'ri`
        : `${DOCUMENT_FIELD_LABELS[fieldName]} fayli juda katta`;
      fieldErrors[fieldName] = [message];
      continue;
    }
    for (const file of files) {
      validFiles.push({ fieldName, file });
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    res.status(400).json({ ok: false, error: "Hujjatlarda xatolik bor", fieldErrors });
    return;
  }

  const { website: _honeypot, ...data } = parsed.data;
  const submissionId = nanoid();
  const ipHash = hashIp(req.ip ?? "unknown");

  try {
    saveSubmission(submissionId, data, ipHash);
    for (const { fieldName, file } of validFiles) {
      saveSubmissionFile(submissionId, {
        fieldName,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      });
    }
  } catch (err) {
    logger.error({ err }, "Arizani mahalliy bazaga saqlashda xatolik");
    res.status(500).json({ ok: false, error: "Serverda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring." });
    return;
  }

  const pinflMasked = maskForLog(data.domesticPinfl);

  const adminAttachments: AdminPanelFileAttachment[] = validFiles.map(({ fieldName, file }) => ({
    fieldName,
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    buffer: file.buffer,
  }));
  const bitrixAttachments: BitrixFileAttachment[] = validFiles.map(({ fieldName, file }) => ({
    fieldName,
    originalFilename: file.originalname,
    buffer: file.buffer,
  }));

  // Ikkala manzilga mustaqil ravishda yuboriladi — biri muvaffaqiyatsiz bo'lsa ham,
  // ikkinchisiga ta'sir qilmaydi, har biri o'zicha qayta uriniladi. "inFlight" belgisi
  // fon jarayoni (retryWorker) shu arizani parallel ravishda yana yubormasligini
  // (dublikat yaratmasligini) ta'minlaydi.
  markInFlight(submissionId);
  let adminResult: PromiseSettledResult<string>;
  let bitrixResult: PromiseSettledResult<string>;
  try {
    [adminResult, bitrixResult] = await Promise.allSettled([
      submitToAdminPanel(data, adminAttachments),
      pushDealToBitrix(data, bitrixAttachments),
    ]);
  } finally {
    clearInFlight(submissionId);
  }

  if (adminResult.status === "fulfilled") {
    markAdminSent(submissionId, adminResult.value);
    logger.info({ submissionId, externalId: adminResult.value, pinflMasked }, "Ariza admin panelga yuborildi");
  } else {
    const message = adminResult.reason instanceof Error ? adminResult.reason.message : "Noma'lum xatolik";
    markAdminFailed(submissionId, message);
    if (!(adminResult.reason instanceof AdminPanelNotConfiguredError)) {
      logger.error({ submissionId, err: message }, "Admin panelga yuborishda xatolik, keyinroq qayta urinib ko'riladi");
    }
  }

  if (bitrixResult.status === "fulfilled") {
    markBitrixSent(submissionId, bitrixResult.value);
    logger.info({ submissionId, dealId: bitrixResult.value, pinflMasked }, "Ariza Bitrix24'ga (sdelka) yuborildi");
  } else {
    const message = bitrixResult.reason instanceof Error ? bitrixResult.reason.message : "Noma'lum xatolik";
    markBitrixFailed(submissionId, message);
    if (!(bitrixResult.reason instanceof BitrixNotConfiguredError)) {
      logger.error({ submissionId, err: message }, "Bitrix24'ga yuborishda xatolik, keyinroq qayta urinib ko'riladi");
    }
  }

  res.json({ ok: true, submissionId });
});

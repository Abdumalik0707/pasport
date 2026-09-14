import {
  getPendingOrFailedSubmissions,
  getSubmissionFiles,
  readAndDecryptFile,
  markBitrixSent,
  markBitrixFailed,
  markAdminSent,
  markAdminFailed,
} from "../db";
import { submitToAdminPanel, AdminPanelNotConfiguredError, type AdminPanelFileAttachment } from "./adminPanel";
import { pushDealToBitrix, BitrixNotConfiguredError, type BitrixFileAttachment } from "./bitrix";
import { logger } from "../logger";
import { config } from "../config";

const MAX_ATTEMPTS = 8;
const INTERVAL_MS = 60_000;

async function runOnce(): Promise<void> {
  const adminConfigured = Boolean(config.adminPanel.apiUrl && config.adminPanel.apiKey);
  const bitrixConfigured = Boolean(config.bitrix.webhookUrl);
  if (!adminConfigured && !bitrixConfigured) return;

  const pending = getPendingOrFailedSubmissions(MAX_ATTEMPTS);
  for (const submission of pending) {
    const fileMetas = getSubmissionFiles(submission.id);

    if (adminConfigured && submission.adminStatus !== "sent" && submission.adminAttempts < MAX_ATTEMPTS) {
      try {
        const files: AdminPanelFileAttachment[] = fileMetas.map((meta) => ({
          fieldName: meta.fieldName,
          originalFilename: meta.originalFilename,
          mimeType: meta.mimeType,
          buffer: readAndDecryptFile(meta.storagePath),
        }));
        const externalId = await submitToAdminPanel(submission.data, files);
        markAdminSent(submission.id, externalId);
        logger.info({ submissionId: submission.id, externalId }, "Kechiktirilgan ariza admin panelga yuborildi");
      } catch (err) {
        if (!(err instanceof AdminPanelNotConfiguredError)) {
          const message = err instanceof Error ? err.message : "Noma'lum xatolik";
          markAdminFailed(submission.id, message);
          logger.warn({ submissionId: submission.id, err: message }, "Admin panelga qayta urinish muvaffaqiyatsiz");
        }
      }
    }

    if (bitrixConfigured && submission.bitrixStatus !== "sent" && submission.bitrixAttempts < MAX_ATTEMPTS) {
      try {
        const files: BitrixFileAttachment[] = fileMetas.map((meta) => ({
          fieldName: meta.fieldName,
          originalFilename: meta.originalFilename,
          buffer: readAndDecryptFile(meta.storagePath),
        }));
        const dealId = await pushDealToBitrix(submission.data, files);
        markBitrixSent(submission.id, dealId);
        logger.info({ submissionId: submission.id, dealId }, "Kechiktirilgan ariza Bitrix24'ga (sdelka) yuborildi");
      } catch (err) {
        if (!(err instanceof BitrixNotConfiguredError)) {
          const message = err instanceof Error ? err.message : "Noma'lum xatolik";
          markBitrixFailed(submission.id, message);
          logger.warn({ submissionId: submission.id, err: message }, "Bitrix24'ga qayta urinish muvaffaqiyatsiz");
        }
      }
    }
  }
}

let timer: NodeJS.Timeout | undefined;

export function startRetryWorker(): void {
  if (timer) return;
  timer = setInterval(() => {
    runOnce().catch((err) => logger.error({ err }, "Retry worker kutilmagan xatolik"));
  }, INTERVAL_MS);
  timer.unref();
}

export function stopRetryWorker(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}

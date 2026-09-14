import { getPendingOrFailedSubmissions, getSubmissionFiles, readAndDecryptFile, markBitrixSent, markBitrixFailed } from "../db";
import { pushLeadToBitrix, BitrixNotConfiguredError, type BitrixFileAttachment } from "./bitrix";
import { logger } from "../logger";
import { config } from "../config";

const MAX_ATTEMPTS = 8;
const INTERVAL_MS = 60_000;

async function runOnce(): Promise<void> {
  if (!config.bitrix.webhookUrl) return;

  const pending = getPendingOrFailedSubmissions(MAX_ATTEMPTS);
  for (const submission of pending) {
    try {
      const fileMetas = getSubmissionFiles(submission.id);
      const bitrixFiles: BitrixFileAttachment[] = fileMetas.map((meta) => ({
        fieldName: meta.fieldName,
        originalFilename: meta.originalFilename,
        buffer: readAndDecryptFile(meta.storagePath),
      }));

      const leadId = await pushLeadToBitrix(submission.data, bitrixFiles);
      markBitrixSent(submission.id, leadId);
      logger.info({ submissionId: submission.id, leadId }, "Kechiktirilgan ariza Bitrix24'ga yuborildi");
    } catch (err) {
      if (err instanceof BitrixNotConfiguredError) return;
      const message = err instanceof Error ? err.message : "Noma'lum xatolik";
      markBitrixFailed(submission.id, message);
      logger.warn({ submissionId: submission.id, err: message }, "Qayta urinish muvaffaqiyatsiz tugadi");
    }
  }
}

let timer: NodeJS.Timeout | undefined;

export function startBitrixRetryWorker(): void {
  if (timer) return;
  timer = setInterval(() => {
    runOnce().catch((err) => logger.error({ err }, "Retry worker kutilmagan xatolik"));
  }, INTERVAL_MS);
  timer.unref();
}

export function stopBitrixRetryWorker(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}

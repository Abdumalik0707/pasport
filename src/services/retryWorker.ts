import { getPendingOrFailedSubmissions, getSubmissionFiles, readAndDecryptFile, markSynced, markSyncFailed } from "../db";
import { submitToAdminPanel, AdminPanelNotConfiguredError, type AdminPanelFileAttachment } from "./adminPanel";
import { logger } from "../logger";
import { config } from "../config";

const MAX_ATTEMPTS = 8;
const INTERVAL_MS = 60_000;

async function runOnce(): Promise<void> {
  if (!config.adminPanel.apiUrl || !config.adminPanel.apiKey) return;

  const pending = getPendingOrFailedSubmissions(MAX_ATTEMPTS);
  for (const submission of pending) {
    try {
      const fileMetas = getSubmissionFiles(submission.id);
      const files: AdminPanelFileAttachment[] = fileMetas.map((meta) => ({
        fieldName: meta.fieldName,
        originalFilename: meta.originalFilename,
        mimeType: meta.mimeType,
        buffer: readAndDecryptFile(meta.storagePath),
      }));

      const externalId = await submitToAdminPanel(submission.data, files);
      markSynced(submission.id, externalId);
      logger.info({ submissionId: submission.id, externalId }, "Kechiktirilgan ariza admin panelga yuborildi");
    } catch (err) {
      if (err instanceof AdminPanelNotConfiguredError) return;
      const message = err instanceof Error ? err.message : "Noma'lum xatolik";
      markSyncFailed(submission.id, message);
      logger.warn({ submissionId: submission.id, err: message }, "Qayta urinish muvaffaqiyatsiz tugadi");
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

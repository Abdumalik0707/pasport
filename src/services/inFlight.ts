// Hozir so'rov handler tomonidan sinxron ravishda yuborilayotgan arizalar ro'yxati.
// Fon jarayoni (retryWorker) shu ro'yxatdagi ID'larni chetlab o'tadi — bu bitta
// arizaning ikki marta (ham sinxron, ham fon jarayoni orqali) yuborilib ketishining
// oldini oladi.
const inFlightSubmissionIds = new Set<string>();

export function markInFlight(submissionId: string): void {
  inFlightSubmissionIds.add(submissionId);
}

export function clearInFlight(submissionId: string): void {
  inFlightSubmissionIds.delete(submissionId);
}

export function isInFlight(submissionId: string): boolean {
  return inFlightSubmissionIds.has(submissionId);
}

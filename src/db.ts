import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config";
import { encryptField, decryptField, encryptBuffer, decryptBuffer } from "./services/crypto";
import type { ApplicationInput, DocumentFieldName } from "./validation";

const dbDir = path.dirname(config.db.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const uploadsDir = path.join(dbDir, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const db = new DatabaseSync(config.db.path);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    encrypted_payload TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    external_id TEXT,
    sync_attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_submissions_sync_status ON submissions(sync_status);`);

db.exec(`
  CREATE TABLE IF NOT EXISTS submission_files (
    id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL REFERENCES submissions(id),
    field_name TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_submission_files_submission_id ON submission_files(submission_id);`);

export interface StoredSubmission {
  id: string;
  createdAt: string;
  data: ApplicationInput;
  syncStatus: "pending" | "sent" | "failed";
  syncAttempts: number;
}

export function saveSubmission(id: string, data: ApplicationInput, ipHash: string): void {
  const encrypted = encryptField(JSON.stringify(data));
  db.prepare(`INSERT INTO submissions (id, encrypted_payload, ip_hash) VALUES (?, ?, ?)`).run(
    id,
    encrypted,
    ipHash
  );
}

export function markSynced(id: string, externalId: string): void {
  db.prepare(
    `UPDATE submissions SET sync_status = 'sent', external_id = ?, last_error = NULL WHERE id = ?`
  ).run(externalId, id);
}

export function markSyncFailed(id: string, errorMessage: string): void {
  db.prepare(
    `UPDATE submissions
     SET sync_status = 'failed', sync_attempts = sync_attempts + 1, last_error = ?
     WHERE id = ?`
  ).run(errorMessage.slice(0, 500), id);
}

interface SubmissionRow {
  id: string;
  created_at: string;
  encrypted_payload: string;
  sync_status: "pending" | "sent" | "failed";
  sync_attempts: number;
}

export function getPendingOrFailedSubmissions(maxAttempts: number): StoredSubmission[] {
  const rows = db
    .prepare(
      `SELECT id, created_at, encrypted_payload, sync_status, sync_attempts
       FROM submissions
       WHERE sync_status IN ('pending', 'failed') AND sync_attempts < ?
       ORDER BY created_at ASC
       LIMIT 20`
    )
    .all(maxAttempts) as unknown as SubmissionRow[];

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    data: JSON.parse(decryptField(row.encrypted_payload)) as ApplicationInput,
    syncStatus: row.sync_status,
    syncAttempts: row.sync_attempts,
  }));
}

/** So'rov manbasini kuzatish uchun IP manzilni qaytarib bo'lmaydigan holda xeshlaydi (rate-limit tahlili uchun). */
export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + config.encryptionKey.toString("hex")).digest("hex");
}

export interface IncomingFile {
  fieldName: DocumentFieldName;
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface StoredFileMeta {
  id: string;
  fieldName: DocumentFieldName;
  originalFilename: string;
  mimeType: string;
  storagePath: string;
}

/** Yuklangan faylni shifrlab diskka yozadi va metama'lumotini bazaga qo'shadi. */
export function saveSubmissionFile(submissionId: string, file: IncomingFile): void {
  const submissionDir = path.join(uploadsDir, submissionId);
  if (!fs.existsSync(submissionDir)) {
    fs.mkdirSync(submissionDir, { recursive: true });
  }
  const fileId = crypto.randomUUID();
  // Bir xil maydonga (masalan diploma) bir nechta fayl yuklanishi mumkin bo'lgani uchun
  // fayl nomi noyob ID asosida yaratiladi, fieldName asosida emas.
  const storagePath = path.join(submissionDir, `${file.fieldName}-${fileId}.enc`);
  fs.writeFileSync(storagePath, encryptBuffer(file.buffer));

  db.prepare(
    `INSERT INTO submission_files (id, submission_id, field_name, original_filename, mime_type, storage_path)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(fileId, submissionId, file.fieldName, file.originalFilename, file.mimeType, storagePath);
}

interface SubmissionFileRow {
  id: string;
  field_name: DocumentFieldName;
  original_filename: string;
  mime_type: string;
  storage_path: string;
}

export function getSubmissionFiles(submissionId: string): StoredFileMeta[] {
  const rows = db
    .prepare(
      `SELECT id, field_name, original_filename, mime_type, storage_path FROM submission_files WHERE submission_id = ?`
    )
    .all(submissionId) as unknown as SubmissionFileRow[];

  return rows.map((row) => ({
    id: row.id,
    fieldName: row.field_name,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
  }));
}

/** Diskdagi shifrlangan faylni o'qib, asl (ochiq) baytlarni qaytaradi. */
export function readAndDecryptFile(storagePath: string): Buffer {
  return decryptBuffer(fs.readFileSync(storagePath));
}

import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config";

const COOKIE_NAME = "csrf_token";
const HEADER_NAME = "x-csrf-token";

function sign(value: string): string {
  return crypto.createHmac("sha256", config.encryptionKey).update(value).digest("hex");
}

/** Har bir GET / sahifa yuklanganda double-submit-cookie CSRF tokenini o'rnatadi. */
export function issueCsrfToken(req: Request, res: Response, next: NextFunction): void {
  const raw = crypto.randomBytes(24).toString("hex");
  const token = `${raw}.${sign(raw)}`;
  res.cookie(COOKIE_NAME, token, {
    httpOnly: false, // JS tomonidan o'qilib, so'rov headeriga qo'shilishi kerak
    sameSite: "strict",
    secure: config.isProd,
    maxAge: 2 * 60 * 60 * 1000,
  });
  res.locals.csrfToken = token;
  next();
}

/** POST so'rovlarda cookie va header'dagi tokenlar mos kelishini tekshiradi. */
export function verifyCsrfToken(req: Request, res: Response, next: NextFunction): void {
  const cookieToken = req.cookies?.[COOKIE_NAME];
  const headerToken = req.get(HEADER_NAME);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ ok: false, error: "CSRF tekshiruvi muvaffaqiyatsiz. Sahifani yangilab qayta urinib ko'ring." });
    return;
  }

  const [raw, signature] = cookieToken.split(".");
  if (!raw || !signature || sign(raw) !== signature) {
    res.status(403).json({ ok: false, error: "CSRF tokeni yaroqsiz." });
    return;
  }

  next();
}

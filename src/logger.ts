import pino from "pino";
import { config } from "./config";

// Diqqat: pasport seriya-raqami va JSHSHIR kabi maxfiy maydonlar hech qachon
// to'liq holda log'ga yozilmasligi kerak — shu sabab avtomatik "redact" qo'llanadi.
export const logger = pino({
  level: config.isProd ? "info" : "debug",
  redact: {
    paths: ["*.pinfl", "*.passportSeriesNumber", "req.headers.cookie", "req.headers.authorization"],
    censor: "[MAXFIY]",
  },
});

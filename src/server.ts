import path from "node:path";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config, assertAdminPanelConfigured } from "./config";
import { logger } from "./logger";
import { issueCsrfToken, verifyCsrfToken } from "./middleware/csrf";
import { applyRouter } from "./routes/apply";
import { startRetryWorker } from "./services/retryWorker";

assertAdminPanelConfigured();

const app = express();

// Nginx/Caddy kabi teskari-proksi ortida to'g'ri IP manzilni olish uchun.
app.set("trust proxy", config.isProd ? 1 : false);
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    hsts: config.isProd ? { maxAge: 15552000, includeSubDomains: true, preload: true } : false,
  })
);
app.use(compression());
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

app.get("/api/csrf-token", issueCsrfToken, (_req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});

const submitLimiter = rateLimit({
  windowMs: config.rateLimit.windowMinutes * 60 * 1000,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring." },
});

app.use("/api/apply", submitLimiter, verifyCsrfToken, applyRouter);

app.use(
  express.static(path.join(__dirname, "..", "public"), {
    extensions: ["html"],
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Sahifa topilmadi" });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Kutilmagan server xatosi");
  res.status(500).json({ ok: false, error: "Serverda kutilmagan xatolik yuz berdi" });
});

app.listen(config.port, () => {
  logger.info(`Server ${config.publicOrigin} manzilida ${config.port}-portda ishga tushdi`);
  startRetryWorker();
});

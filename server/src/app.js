import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import { rateLimiter } from "./middlewares/rateLimit.js";
import { adminApi, health, userApi } from "./routes/index.js";
import { logger } from "./utils/logger.js";

// Only what a browser app needs; the token travels in the Authorization header, never a cookie.
const corsFor = (origin) =>
  cors({
    origin,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  });

const bodyParser = express.json({ limit: "10kb" });

export const createApp = () => {
  const app = express();
  if (env.TRUST_PROXY !== undefined) app.set("trust proxy", env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url.startsWith("/health") },
      customLogLevel: (_req, res, error) =>
        error || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
    })
  );
  app.use(helmet());
  // JSON lists are large and repetitive, so gzip cuts what a phone has to download. A realtime stream must
  // reach the browser as it is written, never buffered for compression, so it is left alone.
  app.use(
    compression({
      filter: (req, res) => !String(res.getHeader("Content-Type")).startsWith("text/event-stream") && compression.filter(req, res),
    })
  );

  app.use("/health", health);

  // Two separate front doors on one server, each callable from its own website only.
  app.use("/api/v1", corsFor(env.CLIENT_ORIGINS), rateLimiter(120), bodyParser, userApi);
  app.use("/api/admin", corsFor(env.ADMIN_ORIGINS), rateLimiter(240), bodyParser, adminApi);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};

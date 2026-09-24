import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { checkDependencies } from "./services/healthService.js";
import { startRealtimeWatchers } from "./services/realtimeWatchers.js";
import { logger } from "./utils/logger.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;
const WARMUP_TIMEOUT_MS = 5_000;

// The Firebase Admin SDK connects to Firestore/Auth lazily, on its first real call: without this, that
// cold-start cost (a second or more) lands on whichever user happens to send the first request after a
// restart, and looks like the app failing or hanging. Fail loudly, but do not block startup forever if
// Firebase is genuinely unreachable — /health/ready keeps reporting the state and the service may recover.
const warmUp = async () => {
  const result = await Promise.race([
    checkDependencies(),
    new Promise((resolve) => setTimeout(resolve, WARMUP_TIMEOUT_MS)),
  ]);
  if (!result) {
    logger.warn("Firebase warm-up did not finish in time; starting anyway");
    return;
  }
  const { firestore, auth } = result;
  if (!firestore.ok) logger.error({ reason: firestore.message }, "Firestore is not reachable");
  if (!auth.ok) logger.error({ reason: auth.message }, "Firebase Auth is not reachable");
  if (firestore.ok && auth.ok) logger.info("Connected to Firestore and Firebase Auth");
};

await warmUp();

const server = createApp().listen(env.PORT, () => {
  logger.info(`API listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
  if (env.ALLOW_PHONE_LOGIN) {
    logger.warn(
      "ALLOW_PHONE_LOGIN is on: anyone who knows a phone number can sign in as it. Development only."
    );
  }
  startRealtimeWatchers();
});

// Finish the requests in flight, then exit. Container platforms send SIGTERM before stopping.
const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down`);
  const timer = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
  timer.unref();
  server.close(() => process.exit(0));
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// A bug that escaped every handler leaves the process in an unknown state: log it and restart clean.
process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "Unhandled promise rejection");
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  process.exit(1);
});

import dotenv from "dotenv";
import { z } from "zod";

if (process.env.NODE_ENV !== "test") dotenv.config({ quiet: true });

const isTimeZone = (value) => {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const flag = z.enum(["true", "false"]).default("false");
const origins = (value) =>
  value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(8080),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),

    // Website origins allowed to call each API from a browser, comma separated.
    CLIENT_ORIGIN: z.string().default("http://localhost:3100"),
    ADMIN_ORIGIN: z.string().default("http://localhost:3101"),
    // The hospital and blood bank website (hospitalandbloodbanksubadmin/).
    // Optional in production (nothing may call the hospital / blood bank API until it is set).
    ORG_ORIGIN: z.string().optional(),
    // Number of reverse proxies in front of the server (needed for rate limiting by IP).
    TRUST_PROXY: z.coerce.number().int().min(0).optional(),

    // Firebase Admin credentials, first match wins: inline JSON, key file path, then Application Default Credentials.
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),

    // Admin dashboard.
    ADMIN_TIMEZONE: z
      .string()
      .default("UTC")
      .refine(isTimeZone, "must be an IANA time zone, e.g. Asia/Kolkata"),
    LOW_STOCK_ML: z.coerce.number().int().min(1).default(1000),
    INACTIVE_DAYS: z.coerce.number().int().min(1).default(30),
    // How long a blood unit may be stored before it expires (whole blood / PRBC shelf life).
    SHELF_LIFE_DAYS: z.coerce.number().int().min(1).default(42),
    // A unit expiring within this many days is flagged to the blood bank and the admin dashboard.
    EXPIRY_WARNING_DAYS: z.coerce.number().int().min(1).default(7),

    // How long (ms) a verified sign-in token and the user's profile are reused before being checked again
    // with Firebase/Firestore. Every request used to pay for both lookups. 0 turns the caching off.
    AUTH_CACHE_TTL_MS: z.coerce.number().int().min(0).default(30_000),

    // Development only: signs a phone number in without an OTP. Refused in production.
    ALLOW_PHONE_LOGIN: flag,
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && value.ALLOW_PHONE_LOGIN === "true") {
      ctx.addIssue({
        code: "custom",
        path: ["ALLOW_PHONE_LOGIN"],
        message: "must not be enabled in production: anyone who knows a phone number could sign in as it",
      });
    }
  });

/** Validates a raw environment (e.g. process.env) and returns the typed configuration. */
export const parseEnv = (source) => {
  const present = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  if (present.NODE_ENV === "production") {
    const missing = ["CLIENT_ORIGIN", "ADMIN_ORIGIN"].filter((key) => !present[key]);
    if (missing.length) {
      throw new Error(`Invalid environment:\n  - ${missing.join(", ")}: required in production`);
    }
  }

  const result = schema.safeParse(present);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${lines.join("\n")}`);
  }

  const config = result.data;
  return Object.freeze({
    ...config,
    isProduction: config.NODE_ENV === "production",
    ALLOW_PHONE_LOGIN: config.ALLOW_PHONE_LOGIN === "true",
    CLIENT_ORIGINS: origins(config.CLIENT_ORIGIN),
    ADMIN_ORIGINS: origins(config.ADMIN_ORIGIN),
    ORG_ORIGINS: origins(config.ORG_ORIGIN ?? (config.NODE_ENV === "production" ? "" : "http://localhost:3102")),
  });
};

let parsed;
try {
  parsed = parseEnv(process.env);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

export const env = parsed;

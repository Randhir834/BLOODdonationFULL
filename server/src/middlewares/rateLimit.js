import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

/** Limits each IP to `limit` requests per window (a minute by default). */
export const rateLimiter = (limit, windowMs = 60 * 1000) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === "test",
    message: { success: false, message: "Too many requests, please try again later." },
  });

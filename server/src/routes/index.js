import { Router } from "express";
import adminRoutes from "./admin.routes.js";
import analyticsRoutes from "./analytics.routes.js";
import authRoutes from "./auth.routes.js";
import campRoutes from "./camp.routes.js";
import directoryRoutes from "./directory.routes.js";
import healthRoutes from "./health.routes.js";
import inventoryRoutes from "./inventory.routes.js";
import locationRoutes from "./location.routes.js";
import requestRoutes from "./request.routes.js";

/** Liveness and readiness probes for load balancers and orchestrators, outside the versioned APIs. */
export const health = healthRoutes;

/** API for the user app (donors, hospitals, blood banks), signed in with a phone number. */
export const userApi = Router()
  .use("/auth", authRoutes)
  .use("/inventory", inventoryRoutes)
  .use("/requests", requestRoutes)
  .use("/directory", directoryRoutes)
  .use("/analytics", analyticsRoutes)
  .use("/location", locationRoutes)
  .use("/camps", campRoutes);

/** API for the admin website, signed in with an admin email and password. */
export const adminApi = adminRoutes;

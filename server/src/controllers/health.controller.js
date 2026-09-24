import { checkDependencies, serverInfo } from "../services/healthService.js";

// GET /health: the process is up (liveness probe, touches nothing external)
export const live = (_req, res) => {
  res.json({ success: true, status: "ok", uptimeSeconds: Math.round(process.uptime()) });
};

// GET /health/ready: the process can reach Firestore and Firebase Auth (readiness probe)
export const ready = async (_req, res) => {
  const dependencies = await checkDependencies();
  const healthy = Object.values(dependencies).every((check) => check.ok);
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? "ready" : "degraded",
    dependencies,
    server: serverInfo(),
  });
};

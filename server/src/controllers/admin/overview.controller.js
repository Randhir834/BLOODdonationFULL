import { clearDashboardCache, getDashboard } from "../../services/dashboardService.js";
import { checkDependencies, serverInfo } from "../../services/healthService.js";
import * as audit from "../../services/auditService.js";
import { subscribe } from "../../services/realtimeBus.js";

// GET /me
export const me = (req, res) => {
  res.json({ success: true, admin: req.admin });
};

// GET /dashboard?fresh=1
export const dashboard = async (req, res) => {
  if (req.validated.query.fresh) clearDashboardCache();
  res.json({ success: true, dashboard: await getDashboard() });
};

// GET /system: is everything the app depends on healthy?
export const system = async (_req, res) => {
  const dependencies = await checkDependencies();
  res.json({
    success: true,
    system: { ...dependencies, server: serverInfo(), checkedAt: new Date().toISOString() },
  });
};

// GET /audit-logs?limit=
export const auditLogs = async (req, res) => {
  res.json({ success: true, logs: await audit.list(req.validated.query.limit) });
};

// GET /events (Server-Sent Events): one open connection per browser tab. Pushes `{ resource, at }`
// whenever users, inventory, admins, audit logs or the dashboard numbers change, so pages can refetch
// instead of polling. Never closes on its own; the browser reconnects if the connection drops.
export const events = (req, res) => {
  req.socket.setTimeout(0);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`data: ${JSON.stringify({ resource: "connected", at: new Date().toISOString() })}\n\n`);

  const unsubscribe = subscribe(res);
  req.on("close", unsubscribe);
};

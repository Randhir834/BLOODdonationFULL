import { LIMITS } from "../../constants/index.js";
import { auditLogsCollection } from "../../services/collections.js";
import { buildOrgDashboard } from "../../services/orgDashboardService.js";
import { subscribeOrganisation } from "../../services/orgRealtimeBus.js";

// GET /org/dashboard
export const dashboard = async (req, res) => {
  res.json({ success: true, dashboard: await buildOrgDashboard(req.user) });
};

// GET /org/activity?limit=: what this account has done, newest first
export const activity = async (req, res) => {
  const snap = await auditLogsCollection().where("actorId", "==", req.user._id).limit(LIMITS.MAX_SCAN).get();
  const logs = snap.docs
    .map((doc) => ({ _id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, req.validated.query.limit);
  res.json({ success: true, logs });
};

// GET /org/events (Server-Sent Events): tells this account's open tabs when its own data changes
export const events = (req, res) => {
  req.socket.setTimeout(0);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`data: ${JSON.stringify({ resource: "connected", at: new Date().toISOString() })}\n\n`);
  const unsubscribe = subscribeOrganisation(req.user._id, res);
  req.on("close", unsubscribe);
};

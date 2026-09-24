import { listActiveCamps } from "../services/campService.js";
import { listNearbyPeople, setSharing, updateLocation } from "../services/locationService.js";
import { subscribe } from "../services/realtimeBus.js";
import { ROLES } from "../constants/index.js";

// PATCH /location  { lat, lng, accuracy? } (donors, hospitals, blood banks): reports where this
// device currently is. Sharing turns on the first time this is called.
export const update = async (req, res) => {
  const location = await updateLocation(req.user, req.validated.body);
  res.json({ success: true, location });
};

// PATCH /location/sharing  { enabled }: turning sharing off also deletes the stored location.
export const setLocationSharing = async (req, res) => {
  const locationSharing = await setSharing(req.user, req.validated.body.enabled);
  res.json({ success: true, locationSharing });
};

// GET /location/nearby: hospitals, blood banks and active camps that are sharing their location.
// Donors are never included here, no matter who asks; see locationService.listForAdmin for why.
export const nearby = async (_req, res) => {
  const [people, camps] = await Promise.all([listNearbyPeople(), listActiveCamps()]);
  res.json({
    success: true,
    hospitals: people.filter((person) => person.role === ROLES.HOSPITAL),
    organisations: people.filter((person) => person.role === ROLES.ORGANISATION),
    camps,
  });
};

// GET /location/events (Server-Sent Events): the same push used by the admin website (see
// admin/overview.controller.js), so the app can refetch nearby locations instead of polling.
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

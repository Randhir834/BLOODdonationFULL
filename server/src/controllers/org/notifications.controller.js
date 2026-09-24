import * as notifications from "../../services/notificationService.js";

// GET /org/notifications?unread=&limit=
export const list = async (req, res) => {
  const { unread, limit } = req.validated.query;
  const [{ notifications: rows, total }, unreadCount] = await Promise.all([
    notifications.listNotifications(req.user._id, { unreadOnly: Boolean(unread), limit }),
    notifications.countUnread(req.user._id),
  ]);
  res.json({ success: true, notifications: rows, total, unread: unreadCount });
};

// POST /org/notifications/:id/read
export const read = async (req, res) => {
  await notifications.markRead(req.user._id, req.validated.params.id);
  res.json({ success: true });
};

// POST /org/notifications/read-all
export const readAll = async (req, res) => {
  res.json({ success: true, updated: await notifications.markAllRead(req.user._id) });
};

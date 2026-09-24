import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Empty, LoadError, PageHead, Spinner } from "../../components/Feedback";
import { useApi } from "../../hooks/useApi";
import { useRealtime } from "../../hooks/useRealtime";
import api, { errorMessage } from "../../lib/api";
import { fmtAgo } from "../../lib/format";
import { notify } from "../../lib/notify";

// Where a notification leads. A request opens its detail page; everything else has one obvious home.
export const targetOf = (notification) => {
  const link = notification.link;
  if (!link) return null;
  if (link.type === "request") return `/requests/${link.id}`;
  if (link.type === "stock") return `/stock?bloodGroup=${encodeURIComponent(link.id)}&state=available`;
  if (link.type === "profile") return "/profile";
  return null;
};

/**
 * Everything the website has told this account: new requests in its city, offers, decisions on its offers, low
 * stock and the admin's decision on its registration. Opening one marks it read and goes to what it is about.
 */
export default function NotificationsPage() {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, loading, error, reload } = useApi("/notifications", {
    limit: 100,
    ...(unreadOnly && { unread: "1" }),
  });
  useRealtime("notifications", reload);
  const [busy, setBusy] = useState(false);

  const open = async (notification) => {
    try {
      if (!notification.read) await api.post(`/notifications/${notification._id}/read`);
    } catch (err) {
      notify.error(errorMessage(err));
    }
    const target = targetOf(notification);
    if (target) navigate(target);
    else reload();
  };

  const readAll = async () => {
    setBusy(true);
    try {
      await api.post("/notifications/read-all");
      await reload();
    } catch (err) {
      notify.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const list = data?.notifications ?? [];
  return (
    <div className="stack">
      <PageHead
        title="Notifications"
        actions={
          <div className="page-actions">
            <label className="chip-toggle">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => setUnreadOnly(event.target.checked)}
              />
              Unread only
            </label>
            <button
              type="button"
              className="btn"
              onClick={readAll}
              disabled={busy || !data || data.unread === 0}
            >
              {busy && <Spinner />}
              Mark all as read
            </button>
          </div>
        }
      >
        New requests in your city, offers on your requests, low stock and decisions on your registration.
      </PageHead>

      <Card>
        <LoadError message={error} hasData={!!data} onRetry={reload} />
        {!data && loading && <div className="skeleton-card" aria-hidden="true" />}
        {data && list.length === 0 && (
          <Empty icon="bell" title={unreadOnly ? "Nothing unread" : "No notifications yet"} quiet>
            {unreadOnly ? "You are all caught up." : "When something needs your attention it is listed here."}
          </Empty>
        )}
        {list.length > 0 && (
          <ul className={`notice-list ${loading ? "dim" : ""}`.trim()}>
            {list.map((notification) => (
              <li key={notification._id} className={notification.read ? "" : "is-unread"}>
                <button type="button" className="notice-item" onClick={() => open(notification)}>
                  <span className="notice-dot" aria-hidden="true" />
                  <span>
                    <span className="notice-title">
                      {notification.read ? "" : <span className="sr">Unread: </span>}
                      {notification.title}
                    </span>
                    {notification.body && <span className="notice-body"> {notification.body}</span>}
                  </span>
                  <span className="notice-time">{fmtAgo(notification.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

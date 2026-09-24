import { useEffect, useRef, useState } from "react";
import { Empty, ErrorNote, TruncatedNote } from "../../components/Feedback";
import Pagination from "../../components/Pagination";
import { TableSkeleton } from "../../components/Skeleton";
import { AccountStatus, ApprovalStatus, RoleBadge } from "../../components/Status";
import { useApi } from "../../hooks/useApi";
import { useQueryParams } from "../../hooks/useQueryParams";
import { useRealtime } from "../../hooks/useRealtime";
import { PAGE_SIZE, ROLE_LABEL, VERIFICATION_LABEL } from "../../lib/constants";
import { fmtDateTime, nameOf } from "../../lib/format";
import UserDetail from "./UserDetail";

const SEARCH_DELAY_MS = 350;

export default function UsersPage() {
  const query = useQueryParams();
  const role = query.get("role");
  const status = query.get("status");
  const verification = query.get("verification");
  const q = query.get("q");
  const page = Number(query.get("page")) || 1;
  // `open` is the user shown in the popup. It lives in the address so links from the dashboard work.
  const open = query.get("open");
  const [text, setText] = useState(q);
  // What `q` was the last time *we* set it via typing, so an external change to `q` (browser back/
  // forward, a link elsewhere) can be told apart from our own debounced update and resyncs `text`
  // instead of being immediately overwritten by it.
  const lastPushedQ = useRef(q);
  const { update } = query;

  useEffect(() => {
    if (q !== lastPushedQ.current) {
      setText(q);
      lastPushedQ.current = q;
    }
  }, [q]);

  // Search as you type, but wait a moment so every key press is not a request.
  useEffect(() => {
    if (text === q) return undefined;
    const timer = setTimeout(() => {
      lastPushedQ.current = text;
      update({ q: text });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, q, update]);

  const { data, loading, error, reload } = useApi("/users", {
    role,
    status,
    verification,
    q,
    page,
    pageSize: PAGE_SIZE,
  });
  useRealtime("users", reload);

  const openUser = (id) => update({ open: id }, true);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p>Everyone who signed up in the mobile app.</p>
        </div>
      </div>

      <section className="card">
        <div className="filters">
          <label className="field">
            <span>Search</span>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={role} onChange={(event) => update({ role: event.target.value })}>
              <option value="">All roles</option>
              {Object.entries(ROLE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Approval</span>
            <select value={verification} onChange={(event) => update({ verification: event.target.value })}>
              <option value="">Any approval</option>
              {Object.entries(VERIFICATION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select value={status} onChange={(event) => update({ status: event.target.value })}>
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
        </div>

        <ErrorNote message={error} onRetry={reload} />
        <div className={`table-wrap ${loading ? "dim" : ""}`.trim()}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Approval</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {!data && loading && <TableSkeleton columns={6} />}
              {(data?.users || []).map((user) => (
                // The whole row is a pointer shortcut for the link in its first cell, which keyboard users use.
                <tr key={user._id} className="clickable" onClick={() => openUser(user._id)}>
                  <td>
                    <a
                      href={`?open=${user._id}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openUser(user._id);
                      }}
                    >
                      {nameOf(user)}
                    </a>
                    <div className="sub">{user.address}</div>
                  </td>
                  <td>
                    <RoleBadge role={user.role} />
                  </td>
                  <td>{user.phone}</td>
                  <td>
                    <AccountStatus status={user.status} />
                  </td>
                  <td>
                    <ApprovalStatus role={user.role} verification={user.verification} />
                  </td>
                  <td>{fmtDateTime(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.users.length === 0 && <Empty>No users match these filters.</Empty>}
        </div>
        {data && (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={(next) => update({ page: String(next) }, true)}
          />
        )}
        <TruncatedNote truncated={data?.truncated} />
      </section>

      {open && (
        <UserDetail key={open} id={open} onClose={() => update({ open: "" }, true)} onChanged={reload} />
      )}
    </div>
  );
}

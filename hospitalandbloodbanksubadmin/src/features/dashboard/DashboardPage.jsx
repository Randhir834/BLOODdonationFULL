import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Empty, LoadError, PageHead } from "../../components/Feedback";
import { NavIcon } from "../../components/Icons";
import { PriorityFlag, StatusPill } from "../../components/Status";
import TrendChart from "../../components/TrendChart";
import { useApi } from "../../hooks/useApi";
import { useRealtime } from "../../hooks/useRealtime";
import { MOVEMENT_LABEL, ROLE_LABEL } from "../../lib/constants";
import { fmtAgo, fmtMl, fmtNum, fmtShort, nameOf, orgName } from "../../lib/format";
import { useAuth } from "../auth/authContext";
import IssueBloodModal from "../stock/IssueBloodModal";
import ReceiveBloodModal from "../stock/ReceiveBloodModal";
import Attention from "./Attention";
import StockBars from "./StockBars";

const KIND_PILL = { received: "good", issued: "info", discarded: "critical" };

/** Shaped like the real dashboard, shown only before the first response arrives. */
function DashboardSkeleton() {
  return (
    <>
      <div className="headline" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="stat" key={i}>
            <span className="skeleton-bar" style={{ width: "45%" }} />
            <span className="skeleton-bar lg" style={{ width: "65%", margin: "0.5rem 0" }} />
            <span className="skeleton-bar" style={{ width: "80%" }} />
          </div>
        ))}
      </div>
      <div className="grid-2 start" aria-hidden="true">
        <div className="card skeleton-card" />
        <div className="card skeleton-card" />
      </div>
    </>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const bank = user.role === "organisation";
  const { data, loading, error, reload } = useApi("/dashboard");
  useRealtime("dashboard", reload);
  const [dialog, setDialog] = useState(null); // "receive" | "issue"
  const d = data?.dashboard;

  const head = (
    <PageHead
      title={orgName(user)}
      actions={
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => setDialog("receive")}>
            <NavIcon name="plus" size={18} />
            {bank ? "Record a donation" : "Add blood"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setDialog("issue")}
            disabled={!d || d.stock.totalAvailable <= 0}
          >
            {bank ? "Issue blood" : "Use for a patient"}
          </button>
        </div>
      }
    >
      {ROLE_LABEL[user.role]} dashboard{d ? `, updated ${fmtAgo(d.generatedAt)}` : ""}
    </PageHead>
  );

  if (!d) {
    return (
      <div className="stack">
        {head}
        <LoadError message={error} hasData={false} onRetry={reload} />
        {!error && <DashboardSkeleton />}
      </div>
    );
  }

  const done = () => {
    setDialog(null);
    reload();
  };

  return (
    <div className={`stack ${loading ? "dim" : ""}`.trim()}>
      {head}
      <LoadError message={error} hasData onRetry={reload} />

      <div className="headline">
        <Link className="stat" to="/stock">
          <span className="stat-label">Blood in stock</span>
          <span className="stat-value">{fmtMl(d.stock.totalAvailable)}</span>
          <span className="stat-sub">
            {fmtNum(d.stock.totalUnits)} unit{d.stock.totalUnits === 1 ? "" : "s"}
            {d.stock.expiringSoonMl > 0 && ` · ${fmtMl(d.stock.expiringSoonMl)} expiring soon`}
          </span>
        </Link>
        <Link
          className={`stat ${d.requests.needsAction > 0 ? "stat-attention" : ""}`.trim()}
          to="/requests?needsAction=1"
        >
          <span className="stat-label">Requests waiting for you</span>
          <span className="stat-value">{fmtNum(d.requests.needsAction)}</span>
          <span className="stat-sub">
            {fmtNum(d.requests.open)} open
            {d.requests.offersWaiting > 0 &&
              ` · ${d.requests.offersWaiting} offer${d.requests.offersWaiting === 1 ? "" : "s"} to review`}
            {d.requests.toIssue > 0 && ` · ${d.requests.toIssue} to issue`}
          </span>
        </Link>
        <Link className="stat" to="/requests?priority=emergency&status=pending&relation=city">
          <span className="stat-label">Emergencies in your city</span>
          <span className="stat-value">{fmtNum(d.requests.emergency)}</span>
          <span className="stat-sub">Not yet answered by you</span>
        </Link>
        <Link className="stat" to="/movements">
          <span className="stat-label">Today</span>
          <span className="stat-value">{fmtMl(d.today.received)}</span>
          <span className="stat-sub">
            received · {fmtMl(d.today.issued)} issued
            {d.today.discarded > 0 && ` · ${fmtMl(d.today.discarded)} discarded`}
          </span>
        </Link>
      </div>

      <div className="grid-2 start">
        <Card title="Needs attention">
          <Attention items={d.attention} />
        </Card>
        <Card title="Urgent requests near you" actions={<Link to="/requests?needsAction=1">See all</Link>}>
          {d.requests.urgent.length === 0 ? (
            <Empty quiet icon="clipboard">
              No urgent request is waiting for a response.
            </Empty>
          ) : (
            <ul className="urgent-list">
              {d.requests.urgent.map((request) => (
                <li key={request._id}>
                  <span className="group-tag">{request.bloodGroup}</span>
                  <div>
                    <div className="title-line">
                      <Link className="cell-link" to={`/requests/${request._id}`}>
                        {fmtMl(request.quantity)} for {request.patientName}
                      </Link>
                      <PriorityFlag priority={request.priority} />
                    </div>
                    <div className="sub">
                      {request.location} · {nameOf(request.requester)} · {fmtAgo(request.createdAt)}
                    </div>
                  </div>
                  <Link className="btn btn-small" to={`/requests/${request._id}`}>
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Blood in stock" actions={<Link to="/stock">Manage stock</Link>}>
          <StockBars stock={d.stock.groups} lowStockMl={d.stock.lowStockMl} />
        </Card>
        <Card title="Blood movement, last 14 days">
          <TrendChart trend={d.trend} />
        </Card>
      </div>

      <Card title="Latest movements" actions={<Link to="/movements">See all</Link>}>
        {d.recentMovements.length === 0 ? (
          <Empty quiet icon="list">
            Nothing has moved yet. Blood you receive, issue or discard is listed here.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="cards">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Group</th>
                  <th className="num">Amount</th>
                  <th>{bank ? "Donor / issued to" : "From / used for"}</th>
                </tr>
              </thead>
              <tbody>
                {d.recentMovements.map((movement) => (
                  <tr key={movement._id}>
                    <td className="nowrap" data-label="When">
                      {fmtShort(movement.at)}
                    </td>
                    <td data-label="Type">
                      <StatusPill kind={KIND_PILL[movement.kind]}>{MOVEMENT_LABEL[movement.kind]}</StatusPill>
                    </td>
                    <td data-label="Group">
                      <span className="group-tag">{movement.bloodGroup}</span>
                    </td>
                    <td className="num" data-label="Amount">
                      {fmtMl(movement.quantity)}
                    </td>
                    <td data-label="With">{movement.counterpartName || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {dialog === "receive" && (
        <ReceiveBloodModal role={user.role} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog === "issue" && (
        <IssueBloodModal role={user.role} stock={d.stock} onClose={() => setDialog(null)} onDone={done} />
      )}
    </div>
  );
}

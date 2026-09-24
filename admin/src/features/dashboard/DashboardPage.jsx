import { Link } from "react-router-dom";
import { Card, StatCard } from "../../components/Card";
import { Empty, ErrorNote } from "../../components/Feedback";
import { RoleBadge } from "../../components/Status";
import { useApi } from "../../hooks/useApi";
import { useRealtime } from "../../hooks/useRealtime";
import { fmtDateTime, fmtMl, fmtNum, fmtShort, nameOf } from "../../lib/format";
import Attention from "./Attention";
import StockBars from "./StockBars";
import SystemStatus from "./SystemStatus";
import TrendChart from "./TrendChart";

/** Shaped like the real dashboard, shown only before the first response arrives. */
function DashboardSkeleton() {
  return (
    <>
      <div className="grid-4" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="card stat" key={i}>
            <span className="skeleton-bar" style={{ width: "45%" }} />
            <span className="skeleton-bar lg" style={{ width: "65%" }} />
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
  const { data, loading, error, reload } = useApi("/dashboard");
  useRealtime("dashboard", reload);
  const d = data?.dashboard;

  if (!d) {
    return (
      <div className="stack">
        <h1>Dashboard</h1>
        <ErrorNote message={error} onRetry={reload} />
        {!error && <DashboardSkeleton />}
      </div>
    );
  }

  const inStock = d.stock.reduce((sum, group) => sum + Math.max(0, group.available), 0);

  return (
    <div className={`stack ${loading ? "dim" : ""}`.trim()}>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>
            Updated {fmtDateTime(d.generatedAt)} · days are counted in {d.timezone}
          </p>
        </div>
      </div>
      <ErrorNote message={error} onRetry={reload} />

      <div className="grid-4">
        <StatCard
          label="Users"
          value={fmtNum(d.users.total)}
          sub={`${fmtNum(d.users.donors)} donors · ${fmtNum(d.users.hospitals)} hospitals · ${fmtNum(d.users.organisations)} organisations`}
        />
        <StatCard
          label="Blood in stock"
          value={fmtMl(inStock)}
          sub={`${fmtMl(d.records.mlInLast30Days)} added, ${fmtMl(d.records.mlOutLast30Days)} issued in 30 days`}
        />
        <StatCard
          label="Blood records today"
          value={fmtNum(d.records.today)}
          sub={`${fmtNum(d.records.last7Days)} in the last 7 days · ${fmtNum(d.records.total)} in total`}
        />
        <StatCard
          label="New sign-ups (7 days)"
          value={fmtNum(d.users.newLast7Days)}
          sub={`${fmtNum(d.users.suspended)} suspended account${d.users.suspended === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid-2 start">
        <Card title="Needs attention">
          <Attention items={d.attention} />
        </Card>
        <Card title="System status">
          <SystemStatus />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Blood in stock, all organisations">
          <StockBars stock={d.stock} lowStockMl={d.lowStockMl} />
        </Card>
        <Card title="Blood movement, last 30 days">
          <TrendChart trend={d.trend} />
        </Card>
      </div>

      <div className="grid-2">
        <Card title="Latest blood records" actions={<Link to="/inventory">See all</Link>}>
          {d.recent.records.length === 0 ? (
            <Empty>No blood records yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Group</th>
                    <th className="num">Amount</th>
                    <th>Organisation</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.records.map((record) => (
                    <tr key={record._id}>
                      <td className="nowrap">{fmtShort(record.createdAt)}</td>
                      <td>{record.inventoryType === "in" ? "Added" : "Issued"}</td>
                      <td>{record.bloodGroup}</td>
                      <td className="num">{fmtMl(record.quantity)}</td>
                      <td>{nameOf(record.organisation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Latest sign-ups" actions={<Link to="/users">See all</Link>}>
          {d.recent.signups.length === 0 ? (
            <Empty icon="users">No users yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recent.signups.map((user) => (
                    <tr key={user._id}>
                      <td>
                        <Link to={`/users?open=${user._id}`}>{nameOf(user)}</Link>
                        <div className="sub">{user.phone}</div>
                      </td>
                      <td>
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="nowrap">{fmtShort(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

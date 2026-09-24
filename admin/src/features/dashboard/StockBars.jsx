import { useState } from "react";
import { StatusPill } from "../../components/Status";
import { fmtMl, fmtNum } from "../../lib/format";

/**
 * Blood in stock, one bar per blood group. One series (available ML) means one colour. Status colours are
 * only used for the state (low / out), and always with an icon and a word. The hairline marks the
 * low-stock threshold.
 */
export default function StockBars({ stock, lowStockMl }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(lowStockMl * 1.5, ...stock.map((group) => group.available));
  const pct = (value) => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;

  return (
    <div className="stock">
      <div className="stock-rows">
        <div className="stock-threshold" style={{ "--r": Math.min(1, lowStockMl / max) }} aria-hidden="true">
          <span>Low: under {fmtNum(lowStockMl)} ML</span>
        </div>
        {stock.map((group) => (
          // Hover and focus show the same tooltip, so keyboard users get the numbers too.
          <div
            key={group.bloodGroup}
            className={`stock-row ${hover === group.bloodGroup ? "is-hover" : ""}`.trim()}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            onPointerEnter={() => setHover(group.bloodGroup)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(group.bloodGroup)}
            onBlur={() => setHover(null)}
          >
            <span className="stock-group">{group.bloodGroup}</span>
            <span className="stock-track">
              {group.available > 0 && (
                <span
                  className={`stock-bar ${group.status === "low" ? "is-low" : ""}`.trim()}
                  style={{ width: pct(group.available) }}
                />
              )}
            </span>
            <span className="stock-value">{fmtMl(Math.max(0, group.available))}</span>
            <span className="stock-state">
              {group.status === "out" && <StatusPill kind="critical">Out</StatusPill>}
              {group.status === "low" && <StatusPill kind="warning">Low</StatusPill>}
            </span>
            {hover === group.bloodGroup && (
              <span className="tip stock-tip" role="tooltip">
                <b>{group.bloodGroup}</b> {fmtMl(group.available)} available
                <br />
                <span className="tip-sub">
                  {fmtMl(group.totalIn)} added, {fmtMl(group.totalOut)} issued
                  {group.totalDiscarded > 0 && `, ${fmtMl(group.totalDiscarded)} discarded`}
                </span>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

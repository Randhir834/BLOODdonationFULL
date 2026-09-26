import { useState } from "react";
import { useWidth } from "../hooks/useWidth";
import { fmtDay, fmtMl, fmtNum } from "../lib/format";

const HEIGHT = 250;
const MARGIN = { top: 12, right: 44, bottom: 28, left: 46 };

const SERIES = [
  { key: "in", label: "Blood received", end: "In", color: "var(--series-1)" },
  { key: "out", label: "Blood issued", end: "Out", color: "var(--series-2)" },
];

/** Rounds the top of the axis up to 1, 2, 5 or 10 times a power of ten. */
export const niceMax = (max) => {
  if (max <= 0) return 1000;
  const power = 10 ** Math.floor(Math.log10(max));
  const n = max / power;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * power;
};

/**
 * Blood movement per day, two lines. The crosshair snaps to the nearest day and one tooltip lists both
 * series. The same numbers are in the table view.
 */
export default function TrendChart({ trend }) {
  const [ref, width] = useWidth();
  const [index, setIndex] = useState(null);
  const [table, setTable] = useState(false);

  const total = trend.reduce((sum, day) => sum + day.in + day.out, 0);
  const max = niceMax(Math.max(0, ...trend.flatMap((day) => [day.in, day.out])));
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (i) => MARGIN.left + (trend.length <= 1 ? 0 : (i / (trend.length - 1)) * plotW);
  const y = (value) => MARGIN.top + plotH - (value / max) * plotH;
  const path = (key) =>
    trend.map((day, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(day[key]).toFixed(1)}`).join(" ");

  const nearest = (clientX, rect) => {
    const px = clientX - rect.left - MARGIN.left;
    return Math.max(0, Math.min(trend.length - 1, Math.round((px / plotW) * (trend.length - 1))));
  };
  const onKey = (event) => {
    if (event.key === "ArrowRight") setIndex((i) => Math.min(trend.length - 1, (i ?? -1) + 1));
    if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, (i ?? trend.length) - 1));
    if (event.key === "Escape") setIndex(null);
  };

  const point = index === null ? null : trend[index];
  const labelEvery = width < 520 ? 7 : 5;
  const last = trend.length - 1;
  // When the two lines end at nearly the same height their end labels would overlap: the legend carries identity then.
  const endLabels = Math.abs(y(trend[last].in) - y(trend[last].out)) >= 14;

  return (
    <div className="trend">
      <div className="trend-top">
        <ul className="legend">
          {SERIES.map((series) => (
            <li key={series.key}>
              <span className="key-line" style={{ background: series.color }} />
              {series.label}
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-small" onClick={() => setTable((shown) => !shown)}>
          {table ? "Show chart" : "Show as table"}
        </button>
      </div>

      {table ? (
        <div className="table-wrap trend-table">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th className="num">Added (ML)</th>
                <th className="num">Issued (ML)</th>
                <th className="num">Records</th>
              </tr>
            </thead>
            <tbody>
              {[...trend].reverse().map((day) => (
                <tr key={day.date}>
                  <td>{fmtDay(day.date)}</td>
                  <td className="num">{fmtNum(day.in)}</td>
                  <td className="num">{fmtNum(day.out)}</td>
                  <td className="num">{fmtNum(day.records)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="trend-plot" ref={ref}>
          {total === 0 && <p className="trend-empty">No blood was received or issued in the last 14 days.</p>}
          {width > 0 && (
            // The chart is one focusable image: arrow keys move the crosshair, the table view has exact numbers.
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label="Blood received and issued per day over the last 14 days. Use the table view for exact numbers."
              tabIndex={0}
              onKeyDown={onKey}
              onBlur={() => setIndex(null)}
              onPointerMove={(event) =>
                setIndex(nearest(event.clientX, event.currentTarget.getBoundingClientRect()))
              }
              onPointerLeave={() => setIndex(null)}
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    className="grid"
                    x1={MARGIN.left}
                    x2={width - MARGIN.right}
                    y1={y(tick)}
                    y2={y(tick)}
                  />
                  <text className="axis-text" x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end">
                    {fmtNum(tick)}
                  </text>
                </g>
              ))}
              {trend.map(
                (day, i) =>
                  (last - i) % labelEvery === 0 && (
                    <text key={day.date} className="axis-text" x={x(i)} y={HEIGHT - 8} textAnchor="middle">
                      {fmtDay(day.date)}
                    </text>
                  )
              )}

              {total > 0 &&
                SERIES.map((series) => (
                  <g key={series.key}>
                    <path
                      d={path(series.key)}
                      fill="none"
                      stroke={series.color}
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {/* End dot with a 2px surface ring, and a direct label beside it. */}
                    <circle
                      cx={x(last)}
                      cy={y(trend[last][series.key])}
                      r="4"
                      fill={series.color}
                      stroke="var(--surface)"
                      strokeWidth="2"
                    />
                    {endLabels && (
                      <text className="end-label" x={x(last) + 9} y={y(trend[last][series.key]) + 4}>
                        {series.end}
                      </text>
                    )}
                  </g>
                ))}

              {point && (
                <g>
                  <line
                    className="crosshair"
                    x1={x(index)}
                    x2={x(index)}
                    y1={MARGIN.top}
                    y2={MARGIN.top + plotH}
                  />
                  {SERIES.map((series) => (
                    <circle
                      key={series.key}
                      cx={x(index)}
                      cy={y(point[series.key])}
                      r="4"
                      fill={series.color}
                      stroke="var(--surface)"
                      strokeWidth="2"
                    />
                  ))}
                </g>
              )}
            </svg>
          )}
          {point && (
            <div
              className="tip"
              role="tooltip"
              style={{ left: Math.min(x(index) + 12, Math.max(0, width - 190)), top: MARGIN.top }}
            >
              <div className="tip-sub">{fmtDay(point.date)}</div>
              {SERIES.map((series) => (
                <div className="tip-row" key={series.key}>
                  <span className="key-line" style={{ background: series.color }} />
                  <b>{fmtMl(point[series.key])}</b>
                  <span className="tip-sub">{series.end.toLowerCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

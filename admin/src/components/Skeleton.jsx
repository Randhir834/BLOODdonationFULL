/**
 * Placeholder rows shaped like a real table, shown only while the first page of data is loading
 * (never on a refresh of data already on screen, which uses `.dim` instead).
 */
export function TableSkeleton({ columns, rows = 6 }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} className="skeleton-row" aria-hidden="true">
          {Array.from({ length: columns }, (_, col) => (
            <td key={col}>
              <span className="skeleton-bar" style={{ width: `${50 + ((row * 7 + col * 13) % 40)}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

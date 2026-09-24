export default function Pagination({ page, pageSize, total, onPage }) {
  if (total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);

  return (
    <div className="pagination">
      <span>
        Page {page} of {pages} ({total.toLocaleString()} results)
      </span>
      <div>
        <button type="button" className="btn btn-small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button
          type="button"
          className="btn btn-small"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/** One page of an already filtered list: { total, page, pageSize, rows }. */
export const paginate = (rows, page, pageSize) => ({
  total: rows.length,
  page,
  pageSize,
  rows: rows.slice((page - 1) * pageSize, page * pageSize),
});

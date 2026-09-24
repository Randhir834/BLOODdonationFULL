/** The token of an "Authorization: Bearer <token>" header, or null. */
export const bearerToken = (req) => {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
};

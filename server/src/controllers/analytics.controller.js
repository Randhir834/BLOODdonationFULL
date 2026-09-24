import { BLOOD_GROUPS } from "../constants/index.js";
import { organisationOverview, organisationTotals, populate } from "../services/inventoryService.js";

const perGroup = (totals) => BLOOD_GROUPS.map((bloodGroup) => ({ bloodGroup, ...totals[bloodGroup] }));

// GET /analytics/stock (organisations): blood in, out, discarded and available per blood group.
// `available` already excludes blood that was issued, discarded, or has passed its expiry date.
export const stock = async (req, res) => {
  const { totals, truncated } = await organisationTotals(req.user._id);
  res.json({ success: true, stock: perGroup(totals), truncated });
};

// GET /analytics/overview?recent=5 (organisations): everything the home screen shows in one request, the
// per-group stock plus the newest records, so opening the app is one round trip and one read, not two.
export const overview = async (req, res) => {
  const { totals, records, truncated } = await organisationOverview(req.user._id, req.validated.query.recent);
  res.json({
    success: true,
    stock: perGroup(totals),
    records: await populate(records, ["donar", "hospital"]),
    truncated,
  });
};

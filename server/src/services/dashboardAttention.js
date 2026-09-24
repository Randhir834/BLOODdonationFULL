const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * What is NOT happening, most serious first: shortages, silence, missing sign-ups.
 * Pure function of the dashboard numbers, so it can be tested without a database.
 */
export const buildAttention = ({
  stock,
  lowStockMl,
  inactiveDays,
  recordsToday,
  records7d,
  newUsers7d,
  suspended,
  pendingApproval = 0,
  expiry,
  requests,
  inactiveOrganisations,
  inactiveHospitals,
}) => {
  const attention = [];
  const groupsWith = (status) =>
    stock.filter((group) => group.status === status).map((group) => group.bloodGroup);
  const out = groupsWith("out");
  const low = groupsWith("low");

  if (requests?.emergency > 0) {
    attention.push({
      severity: "critical",
      title: `${plural(requests.emergency, "emergency blood request")} waiting for a response`,
      detail: "A blood bank has not yet fulfilled or rejected these.",
    });
  }
  if (out.length) {
    attention.push({
      severity: "critical",
      title: `${plural(out.length, "blood group")} out of stock`,
      detail: out.join(", "),
    });
  }
  if (expiry?.expiredUnits > 0) {
    attention.push({
      severity: "critical",
      title: `${plural(expiry.expiredUnits, "unit")} past their expiry date`,
      detail: `${expiry.expiredMl} ML still marked available. Run npm run sweep-expired, or discard them from Blood records.`,
      link: { to: "/inventory?status=expired", label: "Review" },
    });
  }
  if (low.length) {
    attention.push({
      severity: "warning",
      title: `${plural(low.length, "blood group")} running low`,
      detail: `${low.join(", ")} (under ${lowStockMl} ML)`,
    });
  }
  if (expiry?.expiringSoonUnits > 0) {
    attention.push({
      severity: "warning",
      title: `${plural(expiry.expiringSoonUnits, "unit")} expiring soon`,
      detail: `${expiry.expiringSoonMl} ML across every blood bank.`,
      link: { to: "/inventory?status=available&sort=expiry", label: "Review" },
    });
  }
  if (requests?.pending > requests?.emergency) {
    attention.push({
      severity: "info",
      title: `${plural(requests.pending - requests.emergency, "blood request")} waiting for a response`,
      detail: requests.emergency > 0 ? "Not counting the emergency ones above." : "",
    });
  }
  if (pendingApproval > 0) {
    attention.push({
      severity: "warning",
      title: `${plural(pendingApproval, "account")} waiting for approval`,
      detail: "Blood banks and hospitals can not use the app until an admin approves them.",
      link: { to: "/users?verification=pending", label: "Review" },
    });
  }
  if (records7d === 0) {
    attention.push({
      severity: "critical",
      title: "No blood movement in the last 7 days",
      detail: "Nothing was added or issued by any organisation.",
    });
  } else if (recordsToday === 0) {
    attention.push({
      severity: "info",
      title: "No blood movement recorded today yet",
      detail: `${plural(records7d, "record")} in the last 7 days.`,
    });
  }
  if (inactiveOrganisations.length) {
    attention.push({
      severity: "warning",
      title: `${plural(inactiveOrganisations.length, "organisation")} inactive for ${inactiveDays}+ days`,
      detail: "No blood added or issued in that time.",
      items: inactiveOrganisations.slice(0, 10),
    });
  }
  if (inactiveHospitals.length) {
    attention.push({
      severity: "info",
      title: `${plural(inactiveHospitals.length, "hospital")} received no blood in ${inactiveDays} days`,
      detail: "Registered, but no blood issued to them.",
      items: inactiveHospitals.slice(0, 10),
    });
  }
  if (newUsers7d === 0) {
    attention.push({ severity: "info", title: "No new sign-ups in the last 7 days", detail: "" });
  }
  if (suspended > 0) {
    attention.push({
      severity: "info",
      title: `${plural(suspended, "suspended account")}`,
      detail: "These users can not sign in.",
    });
  }
  return attention;
};

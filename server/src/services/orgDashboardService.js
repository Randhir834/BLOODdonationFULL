import { env } from "../config/env.js";
import { REQUEST_PRIORITY, ROLES } from "../constants/index.js";
import { DAY_MS, dayKey } from "../utils/time.js";
import { findRecords, ledgerFor } from "./inventoryService.js";
import { listOrgRequests } from "./orgRequestService.js";
import { buildMovements, listShipments, stockSummary } from "./orgStockService.js";

const TREND_DAYS = 14;
const RECENT = 8;

const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

/**
 * What the website's home page shows for one hospital or blood bank: stock at a glance, what is waiting on it,
 * the last two weeks of blood coming in and going out, the latest movements and the things that need attention.
 */
export const buildOrgDashboard = async (org) => {
  const now = Date.now();
  const [stock, requests, { records }] = await Promise.all([
    stockSummary(org),
    listOrgRequests(org, {}),
    findRecords({ organisation: org._id }, undefined, ledgerFor(org)),
  ]);
  const shipments =
    org.role === ROLES.HOSPITAL ? (await listShipments(org, { status: "pending" })).shipments : [];

  // Blood in and out per day, in the site's time zone, oldest first.
  const days = Array.from({ length: TREND_DAYS }, (_, index) =>
    dayKey(new Date(now - (TREND_DAYS - 1 - index) * DAY_MS))
  );
  const byDay = new Map(days.map((day) => [day, { date: day, in: 0, out: 0 }]));
  const movements = buildMovements(records);
  movements.forEach((movement) => {
    const point = byDay.get(dayKey(new Date(movement.at)));
    if (!point || movement.kind === "discarded" || movement.openingBalance) return;
    point[movement.kind === "received" ? "in" : "out"] += movement.quantity;
  });
  const trend = days.map((day) => byDay.get(day));

  const todayKey = days[days.length - 1];
  const today = movements.filter((movement) => dayKey(new Date(movement.at)) === todayKey);

  const open = requests.requests.filter((row) => row.status === "pending" && !row.expired);
  const urgent = open
    .filter((row) => row.relation !== "mine" && row.priority !== REQUEST_PRIORITY.NORMAL && !row.myResponse)
    .sort((a, b) =>
      a.priority === b.priority ? (a.createdAt < b.createdAt ? 1 : -1) : a.priority === "emergency" ? -1 : 1
    )
    .slice(0, 5);

  const outGroups = stock.groups.filter((group) => group.status === "out").map((group) => group.bloodGroup);
  const lowGroups = stock.groups.filter((group) => group.status === "low").map((group) => group.bloodGroup);
  const attention = [];
  if (requests.stats.emergency > 0) {
    attention.push({
      severity: "critical",
      title: `${plural(requests.stats.emergency, "emergency request")} in your city`,
      detail: "Waiting for someone to respond.",
      link: { to: "/requests?priority=emergency&status=pending", label: "Review" },
    });
  }
  if (stock.expiredUnits > 0) {
    attention.push({
      severity: "critical",
      title: `${plural(stock.expiredUnits, "unit")} past the expiry date`,
      detail: `${stock.expiredMl} ML is still counted as stock until you discard it.`,
      link: { to: "/stock?state=expired", label: "Review" },
    });
  }
  if (outGroups.length) {
    attention.push({
      severity: "critical",
      title: `${plural(outGroups.length, "blood group")} out of stock`,
      detail: outGroups.join(", "),
    });
  }
  if (lowGroups.length) {
    attention.push({
      severity: "warning",
      title: `${plural(lowGroups.length, "blood group")} running low`,
      detail: `${lowGroups.join(", ")} (under ${env.LOW_STOCK_ML} ML)`,
    });
  }
  if (stock.expiringSoonMl > 0) {
    attention.push({
      severity: "warning",
      title: `${stock.expiringSoonMl} ML expiring within ${env.EXPIRY_WARNING_DAYS} days`,
      detail: "Use it first or arrange a transfer.",
      link: { to: "/stock?expiring=1&sort=expiry", label: "Review" },
    });
  }
  if (shipments.length) {
    attention.push({
      severity: "info",
      title: `${plural(shipments.length, "delivery", "deliveries")} to confirm`,
      detail: "Blood a blood bank issued to you is not in your stock until you confirm it arrived.",
      link: { to: "/stock?tab=deliveries", label: "Review" },
    });
  }

  return {
    generatedAt: new Date(now).toISOString(),
    stock,
    requests: {
      needsAction: requests.stats.needsAction,
      open: requests.stats.open,
      emergency: requests.stats.emergency,
      mineOpen: open.filter((row) => row.relation === "mine").length,
      offersWaiting: open.reduce((sum, row) => sum + (row.relation === "mine" ? row.pendingResponses : 0), 0),
      toIssue: requests.requests.filter((row) => row.actions.includes("dispatch")).length,
      urgent,
    },
    deliveriesToConfirm: shipments.length,
    today: {
      received: today.filter((m) => m.kind === "received").reduce((sum, m) => sum + m.quantity, 0),
      issued: today.filter((m) => m.kind === "issued").reduce((sum, m) => sum + m.quantity, 0),
      discarded: today.filter((m) => m.kind === "discarded").reduce((sum, m) => sum + m.quantity, 0),
      movements: today.length,
    },
    trend,
    recentMovements: movements.filter((m) => !m.openingBalance).slice(0, RECENT),
    attention,
  };
};

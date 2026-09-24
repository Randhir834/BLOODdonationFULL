import { env } from "../config/env.js";
import { ROLES, USER_STATUS, VERIFICATION } from "../constants/index.js";
import { DAY_MS, dayKey } from "../utils/time.js";
import { usersCollection } from "./collections.js";
import { buildAttention } from "./dashboardAttention.js";
import { countRecords, expirySummary, latestRecords, populate, recordsSince } from "./inventoryService.js";
import { pendingRequestCounts } from "./requestService.js";
import { stockTotals } from "./stockService.js";

const CACHE_MS = 30 * 1000;
const RECENT_LIMIT = 8;

let cache = null;

const count = async (query) => (await query.count().get()).data().count;

// The last `days` day keys in the admin time zone, oldest first.
const lastDays = (days, now) =>
  Array.from({ length: days }, (_, index) => dayKey(new Date(now - (days - 1 - index) * DAY_MS)));

const stockStatus = (available) => {
  if (available <= 0) return "out";
  return available < env.LOW_STOCK_ML ? "low" : "ok";
};

// Users of a role that appear in no recent activity.
const silentUsers = (snapshot, activeIds, nameField) =>
  snapshot.docs
    .filter((doc) => !activeIds.has(doc.id))
    .map((doc) => ({ _id: doc.id, name: doc.get(nameField), phone: doc.get("phone") }));

const build = async () => {
  const now = Date.now();
  const { LOW_STOCK_ML: lowStockMl, INACTIVE_DAYS: inactiveDays } = env;
  const users = usersCollection();
  const scanDays = Math.max(30, inactiveDays);
  const since7Days = new Date(now - 7 * DAY_MS).toISOString();

  const [
    donors,
    hospitals,
    organisations,
    suspended,
    pendingApproval,
    newUsers7d,
    totalRecords,
    sums,
    expiry,
    requests,
    recent,
    organisationDocs,
    hospitalDocs,
    signupDocs,
    latest,
  ] = await Promise.all([
    count(users.where("role", "==", ROLES.DONOR)),
    count(users.where("role", "==", ROLES.HOSPITAL)),
    count(users.where("role", "==", ROLES.ORGANISATION)),
    count(users.where("status", "==", USER_STATUS.SUSPENDED)),
    count(users.where("verification", "==", VERIFICATION.PENDING)),
    count(users.where("createdAt", ">=", since7Days)),
    countRecords(),
    stockTotals(),
    expirySummary(env.EXPIRY_WARNING_DAYS),
    pendingRequestCounts(),
    recordsSince(new Date(now - scanDays * DAY_MS).toISOString()),
    users.where("role", "==", ROLES.ORGANISATION).get(),
    users.where("role", "==", ROLES.HOSPITAL).get(),
    users.orderBy("createdAt", "desc").limit(RECENT_LIMIT).get(),
    latestRecords(RECENT_LIMIT),
  ]);

  // Blood in stock per group, and whether it needs attention. `available` already accounts for
  // blood that was issued, discarded, or has passed its expiry date (see stockService.stockTotals).
  const stock = sums.map((group) => ({ ...group, status: stockStatus(group.available) }));

  // 30 day trend, one point per day.
  const days = lastDays(30, now);
  const byDay = new Map(days.map((day) => [day, { date: day, in: 0, out: 0, records: 0 }]));
  recent.forEach((record) => {
    const point = byDay.get(dayKey(new Date(record.createdAt)));
    if (!point) return;
    point[record.inventoryType] += record.quantity;
    point.records += 1;
  });
  const trend = days.map((day) => byDay.get(day));
  const today = trend[trend.length - 1];
  const records7d = trend.slice(-7).reduce((total, point) => total + point.records, 0);

  // Who has been silent for `inactiveDays`.
  const cutoff = new Date(now - inactiveDays * DAY_MS).toISOString();
  const activeOrganisations = new Set();
  const activeHospitals = new Set();
  recent.forEach((record) => {
    if (record.createdAt < cutoff) return;
    activeOrganisations.add(record.organisation);
    if (record.hospital) activeHospitals.add(record.hospital);
  });

  return {
    generatedAt: new Date(now).toISOString(),
    timezone: env.ADMIN_TIMEZONE,
    lowStockMl,
    users: {
      total: donors + hospitals + organisations,
      donors,
      hospitals,
      organisations,
      newLast7Days: newUsers7d,
      suspended,
      pendingApproval,
    },
    records: {
      total: totalRecords,
      today: today.records,
      last7Days: records7d,
      mlInLast30Days: trend.reduce((total, point) => total + point.in, 0),
      mlOutLast30Days: trend.reduce((total, point) => total + point.out, 0),
    },
    stock,
    trend,
    expiry,
    requests,
    attention: buildAttention({
      stock,
      lowStockMl,
      inactiveDays,
      recordsToday: today.records,
      records7d,
      newUsers7d,
      suspended,
      pendingApproval,
      expiry,
      requests,
      inactiveOrganisations: silentUsers(organisationDocs, activeOrganisations, "organisationName"),
      inactiveHospitals: silentUsers(hospitalDocs, activeHospitals, "hospitalName"),
    }),
    recent: {
      records: await populate(latest, ["donar", "hospital", "organisation"]),
      signups: signupDocs.docs.map((doc) => ({ _id: doc.id, ...doc.data() })),
    },
  };
};

/** Several admins refreshing at once share one computation. Failures are never cached. */
export const getDashboard = () => {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const promise = build();
    cache = { at: Date.now(), promise };
    promise.catch(() => {
      if (cache?.promise === promise) cache = null;
    });
  }
  return cache.promise;
};

/** Lets a "refresh" button bypass the cache. */
export const clearDashboardCache = () => {
  cache = null;
};

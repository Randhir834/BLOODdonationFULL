import { describe, expect, it } from "vitest";
import { buildAttention } from "../src/services/dashboardAttention.js";
import { sumQuantity, totalsByBloodGroup } from "../src/services/stockService.js";
import { paginate } from "../src/utils/pagination.js";
import { dayKey } from "../src/utils/time.js";

describe("totalsByBloodGroup", () => {
  it("adds up blood in and out per group and ignores unknown groups", () => {
    const records = [
      { bloodGroup: "A+", inventoryType: "in", quantity: 450 },
      { bloodGroup: "A+", inventoryType: "in", quantity: 350 },
      { bloodGroup: "A+", inventoryType: "out", quantity: 300 },
      { bloodGroup: "O-", inventoryType: "in", quantity: 100 },
      { bloodGroup: "??", inventoryType: "in", quantity: 999 },
    ];
    const totals = totalsByBloodGroup(records);
    expect(totals["A+"]).toEqual({ totalIn: 800, totalOut: 300 });
    expect(totals["O-"]).toEqual({ totalIn: 100, totalOut: 0 });
    expect(totals["B+"]).toEqual({ totalIn: 0, totalOut: 0 });
    expect(Object.keys(totals)).toHaveLength(8);
  });

  it("sumQuantity sums one direction", () => {
    const records = [
      { inventoryType: "in", quantity: 5 },
      { inventoryType: "out", quantity: 2 },
      { inventoryType: "in", quantity: 7 },
    ];
    expect(sumQuantity(records, "in")).toBe(12);
    expect(sumQuantity(records, "out")).toBe(2);
  });
});

describe("buildAttention", () => {
  const healthy = {
    stock: [{ bloodGroup: "A+", status: "ok" }],
    lowStockMl: 1000,
    inactiveDays: 30,
    recordsToday: 3,
    records7d: 10,
    newUsers7d: 2,
    suspended: 0,
    inactiveOrganisations: [],
    inactiveHospitals: [],
  };

  it("reports nothing when everything is fine", () => {
    expect(buildAttention(healthy)).toEqual([]);
  });

  it("puts shortages first and pluralises", () => {
    const items = buildAttention({
      ...healthy,
      stock: [
        { bloodGroup: "A+", status: "low" },
        { bloodGroup: "O-", status: "out" },
        { bloodGroup: "B-", status: "out" },
      ],
    });
    expect(items[0]).toMatchObject({
      severity: "critical",
      title: "2 blood groups out of stock",
      detail: "O-, B-",
    });
    expect(items[1]).toMatchObject({ severity: "warning", title: "1 blood group running low" });
  });

  it("flags a week without any blood movement as critical", () => {
    const [item] = buildAttention({ ...healthy, records7d: 0, recordsToday: 0 });
    expect(item).toMatchObject({ severity: "critical", title: "No blood movement in the last 7 days" });
  });

  it("asks an admin to review accounts waiting for approval", () => {
    const [item] = buildAttention({ ...healthy, pendingApproval: 3 });
    expect(item).toMatchObject({
      severity: "warning",
      title: "3 accounts waiting for approval",
      link: { to: "/users?verification=pending" },
    });
    expect(buildAttention({ ...healthy, pendingApproval: 1 })[0].title).toBe(
      "1 account waiting for approval"
    );
  });

  it("flags expired units as critical, ahead of a mere low-stock warning", () => {
    const items = buildAttention({
      ...healthy,
      stock: [{ bloodGroup: "A+", status: "low" }],
      expiry: { expiredUnits: 2, expiredMl: 300, expiringSoonUnits: 0, expiringSoonMl: 0 },
    });
    expect(items[0]).toMatchObject({
      severity: "critical",
      title: "2 units past their expiry date",
      detail: "300 ML still marked available. Run npm run sweep-expired, or discard them from Blood records.",
      link: { to: "/inventory?status=expired" },
    });
    expect(items[1].title).toBe("1 blood group running low");
  });

  it("warns about units expiring soon, and says nothing when there is nothing to say", () => {
    const [item] = buildAttention({
      ...healthy,
      expiry: { expiredUnits: 0, expiredMl: 0, expiringSoonUnits: 5, expiringSoonMl: 1200 },
    });
    expect(item).toMatchObject({
      severity: "warning",
      title: "5 units expiring soon",
      detail: "1200 ML across every blood bank.",
    });
    expect(buildAttention(healthy)).toEqual([]);
    expect(
      buildAttention({
        ...healthy,
        expiry: { expiredUnits: 0, expiredMl: 0, expiringSoonUnits: 0, expiringSoonMl: 0 },
      })
    ).toEqual([]);
  });

  it("ranks approvals below stock shortages", () => {
    const items = buildAttention({
      ...healthy,
      pendingApproval: 2,
      stock: [{ bloodGroup: "O-", status: "out" }],
    });
    expect(items.map((item) => item.severity)).toEqual(["critical", "warning"]);
  });

  it("flags emergency requests as critical, ahead of a mere stock shortage", () => {
    const items = buildAttention({
      ...healthy,
      stock: [{ bloodGroup: "O-", status: "out" }],
      requests: { pending: 3, emergency: 1 },
    });
    expect(items[0]).toMatchObject({
      severity: "critical",
      title: "1 emergency blood request waiting for a response",
    });
    expect(items[1].title).toBe("1 blood group out of stock");
  });

  it("mentions ordinary pending requests without double-counting the emergency ones", () => {
    const items = buildAttention({ ...healthy, requests: { pending: 3, emergency: 1 } });
    expect(items[1]).toMatchObject({
      title: "2 blood requests waiting for a response",
      detail: "Not counting the emergency ones above.",
    });
    // no emergencies: just the plain count, no caveat
    const [onlyItem] = buildAttention({ ...healthy, requests: { pending: 2, emergency: 0 } });
    expect(onlyItem).toMatchObject({ title: "2 blood requests waiting for a response", detail: "" });
  });

  it("says nothing about requests when none are pending", () => {
    expect(buildAttention({ ...healthy, requests: { pending: 0, emergency: 0 } })).toEqual([]);
  });

  it("caps the list of silent organisations at ten", () => {
    const silent = Array.from({ length: 14 }, (_, i) => ({ _id: `o${i}`, name: `Org ${i}` }));
    const [item] = buildAttention({ ...healthy, inactiveOrganisations: silent });
    expect(item.title).toBe("14 organisations inactive for 30+ days");
    expect(item.items).toHaveLength(10);
  });
});

describe("paginate", () => {
  it("returns one page and the total", () => {
    const result = paginate([1, 2, 3, 4, 5], 2, 2);
    expect(result).toEqual({ total: 5, page: 2, pageSize: 2, rows: [3, 4] });
  });
});

describe("dayKey", () => {
  it("formats a date as YYYY-MM-DD in the configured time zone", () => {
    expect(dayKey(new Date("2026-09-22T10:30:00Z"))).toBe("2026-09-22");
  });
});

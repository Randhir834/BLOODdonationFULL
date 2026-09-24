import { beforeEach, describe, expect, it, vi } from "vitest";

// The real services run against an in-memory Firestore (see helpers/fakeFirestore.js).
vi.mock("firebase-admin/firestore", async () => {
  const { FieldValue } = await import("./helpers/fakeFirestore.js");
  return { FieldValue };
});
vi.mock("../src/config/firebase.js", async () => {
  const { db } = await import("./helpers/fakeFirestore.js");
  const auth = { updateUser: vi.fn(), revokeRefreshTokens: vi.fn(), deleteUser: vi.fn() };
  return { getDb: () => db, getAdminAuth: () => auth, auth };
});

const { db } = await import("./helpers/fakeFirestore.js");
const { auth } = await import("../src/config/firebase.js");
const users = await import("../src/services/userService.js");
const inventory = await import("../src/services/inventoryService.js");
const stock = await import("../src/services/stockService.js");
const audit = await import("../src/services/auditService.js");
const requests = await import("../src/services/requestService.js");
const { HttpError } = await import("../src/utils/HttpError.js");

const ORG = {
  role: "organisation",
  organisationName: "City Blood Bank",
  phone: "+911000000001",
  status: "active",
  city: "Bengaluru",
  cityKey: "bengaluru",
};
const ORG2 = { ...ORG, organisationName: "Other Blood Bank", phone: "+911000000002" };
const DONOR = {
  role: "donar",
  name: "Asha",
  phone: "+919876543210",
  status: "active",
  city: "Bengaluru",
  cityKey: "bengaluru",
};
const HOSPITAL = {
  role: "hospital",
  hospitalName: "General",
  phone: "+912000000001",
  status: "active",
  city: "Bengaluru",
  cityKey: "bengaluru",
};

const seedPeople = () =>
  db.seed("users", {
    org1: { ...ORG, verification: "approved" },
    org2: { ...ORG2, verification: "approved" },
    donor1: { ...DONOR, verification: "approved" },
    hosp1: { ...HOSPITAL, verification: "approved" },
    hospPending: { ...HOSPITAL, hospitalName: "Pending", phone: "+912000000002", verification: "pending" },
    hospRejected: { ...HOSPITAL, hospitalName: "Rejected", phone: "+912000000003", verification: "rejected" },
    hospLegacy: { ...HOSPITAL, hospitalName: "Legacy", phone: "+912000000004" }, // no `verification`
  });

const add = (organisation, bloodGroup, quantity, phone = DONOR.phone) =>
  inventory.recordBlood({ organisation, phone, inventoryType: "in", bloodGroup, quantity });
const issue = (organisation, bloodGroup, quantity, phone = HOSPITAL.phone) =>
  inventory.recordBlood({ organisation, phone, inventoryType: "out", bloodGroup, quantity });
const stats = () => db.read("stats", "stock");
const rejection = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected a rejection");
};

beforeEach(() => {
  db.reset();
  vi.clearAllMocks();
});

describe("creating a profile", () => {
  it("starts a donor as approved and stores no registration number", async () => {
    const user = await users.createUser("u1", "+919876543210", {
      role: "donar",
      name: "Asha",
      address: "1 Main St",
      city: "Bengaluru",
      website: "",
      registrationNumber: "",
    });
    expect(user).toMatchObject({ _id: "u1", role: "donar", verification: "approved", status: "active" });
    expect(db.read("users", "u1")).not.toHaveProperty("registrationNumber");
  });

  it.each([
    ["organisation", "organisationName"],
    ["hospital", "hospitalName"],
  ])("starts a %s as pending with its registration number", async (role, nameField) => {
    const user = await users.createUser("u2", "+911111111111", {
      role,
      name: "City",
      address: "2 High St",
      city: "Bengaluru",
      website: "",
      registrationNumber: "KA/BB/2041",
    });
    expect(user).toMatchObject({
      verification: "pending",
      registrationNumber: "KA/BB/2041",
      [nameField]: "City",
    });
    expect(db.read("users", "u2")).toMatchObject({ verification: "pending", status: "active" });
  });

  it("does not overwrite a profile that already exists", async () => {
    const profile = {
      role: "donar",
      name: "Asha",
      address: "x",
      city: "Bengaluru",
      website: "",
      registrationNumber: "",
    };
    await users.createUser("u1", "+919876543210", profile);
    expect(await users.createUser("u1", "+910000000000", { ...profile, name: "Someone else" })).toBeNull();
    expect(db.read("users", "u1")).toMatchObject({ name: "Asha", phone: "+919876543210" });
  });

  it("lets the signed-in user correct their own address and city, unapproved or not", async () => {
    seedPeople();
    const pending = await users.findUserById("hospPending");
    const updated = await users.updateOwnProfile(pending, { address: "New address", city: "Mumbai" });
    expect(updated).toMatchObject({ address: "New address", city: "Mumbai", cityKey: "mumbai" });
    expect(db.read("users", "hospPending")).toMatchObject({ city: "Mumbai", cityKey: "mumbai" });
  });
});

describe("approval state", () => {
  it("treats a profile created before approval existed as approved", async () => {
    db.seed("users", { old1: { ...HOSPITAL } });
    const user = await users.findUserById("old1");
    expect(user.verification).toBe("approved");
    expect(users.isApproved(user)).toBe(true);
  });

  it("only hospitals and blood banks need approval", () => {
    expect(users.isApproved({ role: "donar", verification: "pending" })).toBe(true);
    expect(users.isApproved({ role: "hospital", verification: "pending" })).toBe(false);
    expect(users.isApproved({ role: "organisation", verification: "rejected" })).toBe(false);
    expect(users.isApproved({ role: "organisation", verification: "approved" })).toBe(true);
    expect(users.isApproved({ role: "organisation" })).toBe(true);
  });

  it("approves a waiting account and records who did it", async () => {
    seedPeople();
    const user = await users.setVerification("hospPending", "approved", { adminEmail: "boss@example.com" });
    expect(user).toMatchObject({
      verification: "approved",
      verificationReason: "",
      verifiedBy: "boss@example.com",
    });
    expect(user.verifiedAt).toBeTruthy();
    expect(users.isApproved(user)).toBe(true);
  });

  it("rejects with a reason, and a later approval clears the reason", async () => {
    seedPeople();
    const rejected = await users.setVerification("hospPending", "rejected", {
      reason: "Licence not found",
      adminEmail: "boss@example.com",
    });
    expect(rejected).toMatchObject({ verification: "rejected", verificationReason: "Licence not found" });
    const approved = await users.setVerification("hospPending", "approved", {
      adminEmail: "boss@example.com",
    });
    expect(approved).toMatchObject({ verification: "approved", verificationReason: "" });
  });

  it("refuses to approve a donor and returns null for a missing user", async () => {
    seedPeople();
    const error = await rejection(users.setVerification("donor1", "approved"));
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(400);
    expect(await users.setVerification("nobody", "approved")).toBeNull();
  });
});

describe("what other people can see of a profile", () => {
  it("hides the registration number and admin notes from lists shown to other users", async () => {
    db.seed("users", {
      h1: {
        ...HOSPITAL,
        verification: "rejected",
        registrationNumber: "H-77",
        verificationReason: "Licence not found",
        verifiedBy: "boss@example.com",
        verifiedAt: "2026-09-22T10:00:00.000Z",
        statusReason: "Spam",
        statusUpdatedAt: "2026-09-22T10:00:00.000Z",
      },
    });
    const [other] = await users.findUsersByIds(["h1"]);
    expect(other).toMatchObject({ _id: "h1", hospitalName: "General", phone: HOSPITAL.phone });
    for (const field of [
      "registrationNumber",
      "verificationReason",
      "verifiedBy",
      "verifiedAt",
      "statusReason",
      "statusUpdatedAt",
    ]) {
      expect(other).not.toHaveProperty(field);
    }
    // the person themselves, and admins, still get everything
    expect(await users.findUserById("h1")).toMatchObject({
      registrationNumber: "H-77",
      verificationReason: "Licence not found",
    });
  });
});

describe("suspended accounts", () => {
  it("disables the Firebase login and revokes sessions, then re-enables it", async () => {
    seedPeople();
    const suspended = await users.setUserStatus("org1", "suspended", "Spam");
    expect(suspended).toMatchObject({ status: "suspended", statusReason: "Spam" });
    expect(auth.updateUser).toHaveBeenCalledWith("org1", { disabled: true });
    expect(auth.revokeRefreshTokens).toHaveBeenCalledWith("org1");

    const active = await users.setUserStatus("org1", "active");
    expect(active).toMatchObject({ status: "active", statusReason: "" });
    expect(auth.updateUser).toHaveBeenLastCalledWith("org1", { disabled: false });
    expect(auth.revokeRefreshTokens).toHaveBeenCalledOnce();
  });

  it("deletes the login before the profile", async () => {
    seedPeople();
    await users.deleteUser("donor1");
    expect(auth.deleteUser).toHaveBeenCalledWith("donor1");
    expect(await users.findUserById("donor1")).toBeNull();
  });
});

describe("recording blood", () => {
  beforeEach(seedPeople);

  it("adds blood from a donor and updates the running totals", async () => {
    const record = await add("org1", "A+", 450);
    expect(record).toMatchObject({
      inventoryType: "in",
      bloodGroup: "A+",
      quantity: 450,
      organisation: "org1",
      donar: "donor1",
    });
    expect(db.read("inventory", record._id)).toMatchObject({ quantity: 450, donar: "donor1" });
    expect(stats()["A+"]).toEqual({ in: 450 });
  });

  it("issues blood to a hospital and takes it out of stock", async () => {
    await add("org1", "A+", 800);
    const record = await issue("org1", "A+", 300);
    expect(record).toMatchObject({ inventoryType: "out", hospital: "hosp1", quantity: 300 });
    expect(stats()["A+"]).toEqual({ in: 800, out: 300 });
    expect(await stock.stockTotals()).toContainEqual({
      bloodGroup: "A+",
      totalIn: 800,
      totalOut: 300,
      totalDiscarded: 0,
      available: 500,
    });
  });

  it("refuses to issue more than is in stock, and changes nothing", async () => {
    await add("org1", "A+", 450);
    await issue("org1", "A+", 300);
    const before = structuredClone(stats());

    const error = await rejection(issue("org1", "A+", 200));
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(409);
    expect(error.message).toBe("Only 150 ML of A+ is available");
    expect(stats()).toEqual(before);
    expect(db.collectionData("inventory").size).toBe(2);
  });

  it("allows issuing exactly what is left, then nothing more", async () => {
    await add("org1", "O-", 450);
    await issue("org1", "O-", 450);
    expect((await rejection(issue("org1", "O-", 1))).message).toBe("Only 0 ML of O- is available");
  });

  it("only counts the blood bank's own stock, never another blood bank's", async () => {
    await add("org2", "B+", 5000);
    await add("org1", "B+", 100);
    const error = await rejection(issue("org1", "B+", 500));
    expect(error.message).toBe("Only 100 ML of B+ is available");
    // ...and the other blood bank's stock is untouched
    expect((await issue("org2", "B+", 500)).quantity).toBe(500);
  });

  it("keeps blood groups apart", async () => {
    await add("org1", "A+", 900);
    expect((await rejection(issue("org1", "A-", 10))).message).toBe("Only 0 ML of A- is available");
  });

  it("checks the phone number belongs to the right kind of account", async () => {
    expect((await rejection(issue("org1", "A+", 10, DONOR.phone))).message).toBe("Not a hospital account");
    expect((await rejection(add("org1", "A+", 10, HOSPITAL.phone))).message).toBe("Not a donor account");
    const unknown = await rejection(add("org1", "A+", 10, "+910000000000"));
    expect(unknown.status).toBe(404);
    expect(db.collectionData("inventory").size).toBe(0);
  });

  it("only issues blood to hospitals an admin has approved", async () => {
    await add("org1", "A+", 900);
    for (const phone of ["+912000000002", "+912000000003"]) {
      const error = await rejection(issue("org1", "A+", 100, phone));
      expect(error.status).toBe(409);
      expect(error.message).toBe("This hospital has not been approved yet");
    }
    expect(stats()["A+"]).toEqual({ in: 900 });
    // a hospital from before approval existed is treated as approved
    expect((await issue("org1", "A+", 100, "+912000000004")).hospital).toBe("hospLegacy");
  });
});

describe("stock totals", () => {
  beforeEach(seedPeople);

  it("adds up per blood group for one blood bank", async () => {
    await add("org1", "A+", 450);
    await add("org1", "A+", 350);
    await issue("org1", "A+", 300);
    await add("org2", "A+", 9999);
    const { totals } = await inventory.organisationTotals("org1");
    expect(totals["A+"]).toEqual({
      totalIn: 800,
      totalOut: 300,
      totalDiscarded: 0,
      available: 500,
      expiringSoonMl: 0,
    });
    expect(totals["O-"]).toEqual({
      totalIn: 0,
      totalOut: 0,
      totalDiscarded: 0,
      available: 0,
      expiringSoonMl: 0,
    });
  });

  it("gives the home overview the same totals as the stock figures, plus only the newest records", async () => {
    await add("org1", "A+", 450);
    await add("org1", "A+", 350);
    await issue("org1", "A+", 300);
    await add("org1", "O-", 200);
    await add("org2", "A+", 9999);
    const overview = await inventory.organisationOverview("org1", 2);
    const { totals } = await inventory.organisationTotals("org1");
    expect(overview.totals).toEqual(totals);
    expect(overview.records).toHaveLength(2);
    expect(overview.records.every((record) => record.organisation === "org1")).toBe(true);
    expect(overview.records[0].createdAt >= overview.records[1].createdAt).toBe(true);
    expect(overview.truncated).toBe(false);
  });

  it("takes a deleted record back out of the running totals", async () => {
    const kept = await add("org1", "A+", 450);
    const removed = await add("org1", "A+", 350);
    const deleted = await inventory.deleteRecord(removed._id);
    expect(deleted).toMatchObject({ _id: removed._id, quantity: 350 });
    expect(db.read("inventory", removed._id)).toBeUndefined();
    expect(db.read("inventory", kept._id)).toBeDefined();
    expect(stats()["A+"]).toEqual({ in: 450 });
    expect(await inventory.deleteRecord("missing")).toBeNull();
  });

  it("rebuilds the totals from the records when they have drifted", async () => {
    await add("org1", "A+", 450);
    await issue("org1", "A+", 100);
    await add("org2", "O-", 200);
    db.seed("stats", { stock: { "A+": { in: 1, out: 999 } } }); // corrupted
    const { records, totals } = await stock.rebuildStock();
    expect(records).toBe(3);
    expect(totals["A+"]).toEqual({ in: 450, out: 100, discarded: 0 });
    expect(totals["O-"]).toEqual({ in: 200, out: 0, discarded: 0 });
    expect(stats()["A+"]).toEqual({ in: 450, out: 100, discarded: 0 });
  });
});

describe("activity log", () => {
  const admin = { uid: "admin1", email: "boss@example.com" };

  it("records an admin action with who did it", async () => {
    await audit.record(
      admin,
      "user.approve",
      { type: "user", id: "h1", label: "General" },
      { registrationNumber: "R1" }
    );
    const [log] = await audit.list();
    expect(log).toMatchObject({
      actorType: "admin",
      actorId: "admin1",
      actorLabel: "boss@example.com",
      adminEmail: "boss@example.com", // kept so older readers of the log still work
      action: "user.approve",
      targetType: "user",
      targetId: "h1",
      targetLabel: "General",
      details: { registrationNumber: "R1" },
    });
    expect(log.at).toBeTruthy();
  });

  it("records what a blood bank did in the app", async () => {
    seedPeople();
    const org = await users.findUserById("org1");
    await audit.recordActivity(
      org,
      "inventory.add",
      { type: "inventory", id: "r1", label: "450 ML A+" },
      { quantity: 450 }
    );
    const [log] = await audit.list();
    expect(log).toMatchObject({
      actorType: "user",
      actorId: "org1",
      actorLabel: "City Blood Bank",
      actorRole: "organisation",
      action: "inventory.add",
      targetLabel: "450 ML A+",
      details: { quantity: 450 },
    });
    expect(log).not.toHaveProperty("adminEmail");
  });

  it("lists the newest entries first", async () => {
    db.seed("auditLogs", {
      a: { at: "2026-09-20T10:00:00.000Z", action: "first" },
      b: { at: "2026-09-22T10:00:00.000Z", action: "third" },
      c: { at: "2026-09-21T10:00:00.000Z", action: "second" },
    });
    expect((await audit.list(2)).map((log) => log.action)).toEqual(["third", "second"]);
  });

  it("never blocks the person when the log can not be written", async () => {
    const broken = vi.spyOn(db, "collection").mockImplementation(() => {
      throw new Error("firestore is down");
    });
    await expect(audit.record(admin, "user.approve")).resolves.toBeUndefined();
    await expect(
      audit.recordActivity({ _id: "u", role: "donar", name: "A" }, "user.register")
    ).resolves.toBeUndefined();
    broken.mockRestore();
  });
});

describe("blood units", () => {
  beforeEach(seedPeople);

  // Backdates or postdates a stored unit's expiry directly, for deterministic FEFO/expiry tests.
  const setExpiry = (id, iso) => {
    db.read("inventory", id).expiresAt = iso;
  };
  const inDays = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  it("gives every added unit an id, an expiry 42 days out by default, and starts it available", async () => {
    const unit = await add("org1", "A+", 450);
    expect(unit).toMatchObject({ status: "available", consumedQuantity: 0, bloodGroup: "A+", quantity: 450 });
    expect(unit.unitId).toMatch(/^U-\d{8}-[0-9A-Za-z]{1,6}$/);
    const days = (Date.parse(unit.expiresAt) - Date.parse(unit.collectedAt)) / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(42, 5);
  });

  it("draws the earliest-expiring unit first (FEFO), not the newest or the biggest", async () => {
    const soon = await add("org1", "A+", 200);
    const later = await add("org1", "A+", 200);
    const soonest = await add("org1", "A+", 200); // added last, but made to expire first
    setExpiry(soon._id, inDays(20));
    setExpiry(later._id, inDays(30));
    setExpiry(soonest._id, inDays(5));

    const record = await issue("org1", "A+", 200);
    expect(record.unitsConsumed).toEqual([{ unitId: soonest.unitId, unitRefId: soonest._id, quantity: 200 }]);
    expect(db.read("inventory", soonest._id)).toMatchObject({ status: "issued", consumedQuantity: 200 });
    expect(db.read("inventory", soon._id)).toMatchObject({ status: "available", consumedQuantity: 0 });
  });

  it("splits the last unit it needs to draw from, leaving the remainder available", async () => {
    const first = await add("org1", "A+", 200);
    const second = await add("org1", "A+", 300);
    setExpiry(first._id, inDays(5));
    setExpiry(second._id, inDays(10));

    const record = await issue("org1", "A+", 350); // all of `first`, plus 150 of `second`
    expect(record.quantity).toBe(350);
    expect(record.unitsConsumed).toEqual([
      { unitId: first.unitId, unitRefId: first._id, quantity: 200 },
      { unitId: second.unitId, unitRefId: second._id, quantity: 150 },
    ]);
    expect(db.read("inventory", first._id)).toMatchObject({ status: "issued", consumedQuantity: 200 });
    // `second` is only partly drawn from: it stays available, with the rest still to give
    expect(db.read("inventory", second._id)).toMatchObject({ status: "available", consumedQuantity: 150 });

    // the leftover 150 ML of `second` can still be drawn from afterwards
    const again = await issue("org1", "A+", 150);
    expect(again.unitsConsumed).toEqual([{ unitId: second.unitId, unitRefId: second._id, quantity: 150 }]);
    expect(db.read("inventory", second._id)).toMatchObject({ status: "issued", consumedQuantity: 300 });
  });

  it("never draws from a unit past its expiry date, even while it is still marked available", async () => {
    const stale = await add("org1", "O-", 450);
    setExpiry(stale._id, inDays(-1));
    const error = await rejection(issue("org1", "O-", 1));
    expect(error.message).toBe("Only 0 ML of O- is available");
    expect(db.read("inventory", stale._id)).toMatchObject({ status: "available", consumedQuantity: 0 });
  });

  it("never draws from a discarded unit", async () => {
    const unit = await add("org1", "B+", 450);
    await inventory.discardUnit(unit._id, { reason: "damaged" }, { label: "City Blood Bank" });
    const error = await rejection(issue("org1", "B+", 1));
    expect(error.message).toBe("Only 0 ML of B+ is available");
  });

  it("discards a whole untouched unit, records who and why, and bumps the discarded total", async () => {
    const unit = await add("org1", "AB+", 450);
    const discarded = await inventory.discardUnit(
      unit._id,
      { reason: "contaminated", note: "Bag looked cloudy" },
      { label: "City Blood Bank" }
    );
    expect(discarded).toMatchObject({
      status: "discarded",
      discardReason: "contaminated",
      discardNote: "Bag looked cloudy",
    });
    expect(db.read("inventory", unit._id)).toMatchObject({
      status: "discarded",
      discardedBy: "City Blood Bank",
      discardReason: "contaminated",
    });
    expect(stats()["AB+"]).toEqual({ in: 450, discarded: 450 });

    const { totals } = await inventory.organisationTotals("org1");
    expect(totals["AB+"]).toEqual({
      totalIn: 450,
      totalOut: 0,
      totalDiscarded: 450,
      available: 0,
      expiringSoonMl: 0,
    });
  });

  it("refuses to discard a unit that has already had any blood issued from it", async () => {
    const unit = await add("org1", "A-", 450);
    await issue("org1", "A-", 100);
    const error = await rejection(inventory.discardUnit(unit._id, { reason: "damaged" }, {}));
    expect(error.status).toBe(400);
    expect(db.read("inventory", unit._id)).toMatchObject({ status: "available", consumedQuantity: 100 });
  });

  it("refuses to discard a unit twice, an 'out' record, or someone else's unit", async () => {
    const unit = await add("org1", "B-", 450);
    await inventory.discardUnit(unit._id, { reason: "damaged" }, {});
    expect((await rejection(inventory.discardUnit(unit._id, { reason: "damaged" }, {}))).status).toBe(400);

    await add("org1", "A+", 100);
    const record = await issue("org1", "A+", 100);
    expect((await rejection(inventory.discardUnit(record._id, { reason: "damaged" }, {}))).status).toBe(400);

    const other = await add("org2", "O+", 100);
    const stolen = await rejection(
      inventory.discardUnit(other._id, { reason: "damaged", organisation: "org1" }, {})
    );
    expect(stolen.status).toBe(404);
    expect(db.read("inventory", other._id).status).toBe("available"); // untouched by the failed attempt
  });

  it("counts what is expiring soon and what has already expired, across every blood bank", async () => {
    const expired = await add("org1", "A+", 100);
    const soon = await add("org2", "A+", 200);
    const fine = await add("org1", "A+", 300);
    setExpiry(expired._id, inDays(-2));
    setExpiry(soon._id, inDays(3));
    setExpiry(fine._id, inDays(41));

    const summary = await inventory.expirySummary(7);
    expect(summary).toMatchObject({
      expiredUnits: 1,
      expiredMl: 100,
      expiringSoonUnits: 1,
      expiringSoonMl: 200,
    });
  });

  it("does not double count a unit that is both partly issued and expiring", async () => {
    const unit = await add("org1", "A+", 300);
    await issue("org1", "A+", 100); // 200 ML left in the same unit
    setExpiry(unit._id, inDays(1));
    const summary = await inventory.expirySummary(7);
    expect(summary.expiringSoonMl).toBe(200);
  });

  it("also reports expiring-soon ML to the blood bank itself, one blood group at a time", async () => {
    const fine = await add("org1", "A+", 200);
    const soon = await add("org1", "A+", 100);
    const otherGroup = await add("org1", "O-", 50);
    setExpiry(fine._id, inDays(30));
    setExpiry(soon._id, inDays(2));
    setExpiry(otherGroup._id, inDays(2));

    const { totals } = await inventory.organisationTotals("org1");
    expect(totals["A+"]).toMatchObject({ available: 300, expiringSoonMl: 100 });
    expect(totals["O-"]).toMatchObject({ available: 50, expiringSoonMl: 50 });
  });

  it("sweeps expired units into discarded, but leaves a partly-issued one for a person to judge", async () => {
    const wholeExpired = await add("org1", "A+", 100);
    const partlyIssued = await add("org1", "A+", 200);
    const stillGood = await add("org1", "A+", 300);
    setExpiry(wholeExpired._id, inDays(-1));
    await issue("org1", "A+", 50); // draws from the earliest-expiry available unit
    setExpiry(partlyIssued._id, inDays(-1));

    const { checked, discarded } = await inventory.sweepExpiredUnits();
    expect(checked).toBeGreaterThanOrEqual(2);
    expect(discarded).toBe(1);
    expect(db.read("inventory", wholeExpired._id).status).toBe("discarded");
    expect(db.read("inventory", partlyIssued._id).status).toBe("available"); // left alone, not swept
    expect(db.read("inventory", stillGood._id).status).toBe("available");
  });

  describe("deleting a record", () => {
    it("gives an issue's blood back to the units it was drawn from", async () => {
      const first = await add("org1", "A+", 200);
      const second = await add("org1", "A+", 300);
      setExpiry(first._id, inDays(5));
      setExpiry(second._id, inDays(10));
      const record = await issue("org1", "A+", 350);

      await inventory.deleteRecord(record._id);
      expect(db.read("inventory", first._id)).toMatchObject({ status: "available", consumedQuantity: 0 });
      expect(db.read("inventory", second._id)).toMatchObject({ status: "available", consumedQuantity: 0 });
      expect(stats()["A+"]).toEqual({ in: 500, out: 0 }); // the "out" total is reversed back to zero
    });

    it("refuses to delete a unit that any blood has already been issued from", async () => {
      const unit = await add("org1", "A+", 300);
      await issue("org1", "A+", 100);
      const error = await rejection(inventory.deleteRecord(unit._id));
      expect(error.status).toBe(400);
      expect(db.read("inventory", unit._id)).toBeDefined();
    });

    it("deletes an untouched unit outright, and a discarded one reverses the discarded total", async () => {
      const untouched = await add("org1", "B+", 100);
      expect(await inventory.deleteRecord(untouched._id)).toMatchObject({ _id: untouched._id });
      expect(db.read("inventory", untouched._id)).toBeUndefined();

      const discardedUnit = await add("org1", "B+", 200);
      await inventory.discardUnit(discardedUnit._id, { reason: "damaged" }, {});
      expect(stats()["B+"]).toEqual({ in: 200, discarded: 200 });
      await inventory.deleteRecord(discardedUnit._id);
      expect(stats()["B+"]).toEqual({ in: 0, discarded: 0 });
    });
  });

  describe("migrating pre-unit records", () => {
    // records written directly, the way they looked before units existed: no status, no expiry
    const legacyIn = (organisation, bloodGroup, quantity) => ({
      inventoryType: "in",
      bloodGroup,
      quantity,
      phone: DONOR.phone,
      organisation,
      donar: "donor1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const legacyOut = (organisation, bloodGroup, quantity) => ({
      inventoryType: "out",
      bloodGroup,
      quantity,
      phone: HOSPITAL.phone,
      organisation,
      hospital: "hosp1",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    it("tags old records as legacy and opens one available unit per org and group for what is left", async () => {
      db.seed("inventory", {
        r1: legacyIn("org1", "A+", 800),
        r2: legacyOut("org1", "A+", 300),
        r3: legacyIn("org2", "O-", 100), // a different blood bank, kept separate
      });

      const result = await inventory.migrateLegacyRecordsToUnits();
      expect(result).toEqual({ legacyRecordsTagged: 2, openingBalanceUnitsCreated: 2 });
      expect(db.read("inventory", "r1")).toMatchObject({ status: "legacy" });
      expect(db.read("inventory", "r2")).not.toHaveProperty("status"); // "out" records need no tag

      const { totals } = await inventory.organisationTotals("org1");
      expect(totals["A+"].available).toBe(500);
      expect(totals["A+"].totalIn).toBe(800); // the legacy record still counts as blood once added

      // FEFO can now draw from the migrated balance like any other unit
      const record = await issue("org1", "A+", 500);
      expect(record.unitsConsumed[0].unitId).toMatch(/^OPEN-A\+/);
    });

    it("opens no unit for a group whose old balance was zero or negative", async () => {
      db.seed("inventory", { r1: legacyIn("org1", "A-", 100), r2: legacyOut("org1", "A-", 100) });
      const result = await inventory.migrateLegacyRecordsToUnits();
      expect(result.openingBalanceUnitsCreated).toBe(0);
      const { totals } = await inventory.organisationTotals("org1");
      expect(totals["A-"].available).toBe(0);
    });

    it("can be run again safely, without resetting a balance that has since been used", async () => {
      db.seed("inventory", { r1: legacyIn("org1", "A+", 500) });
      await inventory.migrateLegacyRecordsToUnits();
      await issue("org1", "A+", 200); // 300 ML of the opening balance left

      const second = await inventory.migrateLegacyRecordsToUnits();
      expect(second).toEqual({ legacyRecordsTagged: 0, openingBalanceUnitsCreated: 0 });
      const { totals } = await inventory.organisationTotals("org1");
      expect(totals["A+"].available).toBe(300); // not reset back to 500
    });
  });
});

describe("blood requests", () => {
  beforeEach(seedPeople);

  const askAs = async (requesterId, overrides = {}) => {
    const requester = await users.findUserById(requesterId);
    return requests.createRequest(requester, {
      organisation: "org1",
      patientName: "Jane Doe",
      bloodGroup: "A+",
      component: "whole_blood",
      quantity: 450,
      priority: "normal",
      requiredAt: null,
      location: "City Hospital, Ward 4",
      contactName: "",
      contactPhone: "",
      note: "",
      ...overrides,
    });
  };
  const ask = (overrides) => askAs("hosp1", overrides);

  describe("listApprovedOrganisations", () => {
    it("lists active, approved blood banks only, by name, with no admin details", async () => {
      db.seed("users", {
        orgPending: { ...ORG, organisationName: "New Bank", phone: "+911000000003", verification: "pending" },
        orgSuspended: {
          ...ORG,
          organisationName: "Suspended Bank",
          phone: "+911000000004",
          verification: "approved",
          status: "suspended",
        },
      });
      const list = await users.listApprovedOrganisations();
      expect(list.map((org) => org.organisationName)).toEqual(["City Blood Bank", "Other Blood Bank"]);
      expect(list[0]).not.toHaveProperty("registrationNumber");
    });
  });

  describe("creating a request", () => {
    it("creates a pending request against a real, approved blood bank", async () => {
      const request = await ask();
      expect(request).toMatchObject({
        requester: "hosp1",
        requesterRole: "hospital",
        requesterPhone: HOSPITAL.phone,
        organisation: "org1",
        patientName: "Jane Doe",
        bloodGroup: "A+",
        component: "whole_blood",
        quantity: 450,
        location: "City Hospital, Ward 4",
        status: "pending",
      });
      expect(db.read("bloodRequests", request._id)).toMatchObject({ status: "pending" });
    });

    it.each([
      ["a donor", "donor1", "donar"],
      ["a blood bank", "org2", "organisation"],
    ])("lets %s ask a blood bank for blood, on their own or someone else's behalf", async (_, id, role) => {
      const request = await askAs(id);
      expect(request).toMatchObject({ requester: id, requesterRole: role, status: "pending" });
    });

    it("refuses to let a blood bank ask itself", async () => {
      const error = await rejection(askAs("org1"));
      expect(error.status).toBe(400);
    });

    it("refuses an unknown or non-existent blood bank", async () => {
      expect((await rejection(ask({ organisation: "nobody" }))).status).toBe(404);
      expect((await rejection(ask({ organisation: "hospPending" }))).status).toBe(404); // a hospital, not a bank
    });

    it("refuses a blood bank that is not approved", async () => {
      db.seed("users", { orgPending: { ...ORG, phone: "+911000000009", verification: "pending" } });
      const error = await rejection(ask({ organisation: "orgPending" }));
      expect(error.status).toBe(409);
    });

    it("broadcasts to the requester's city when no blood bank is named", async () => {
      const requester = await users.findUserById("hosp1");
      const request = await requests.createRequest(requester, {
        patientName: "Jane Doe",
        bloodGroup: "A+",
        component: "whole_blood",
        quantity: 450,
        priority: "normal",
        requiredAt: null,
        location: "City Hospital, Ward 4",
        contactName: "",
        contactPhone: "",
        note: "",
      });
      expect(request.organisation).toBeNull();
      expect(request.city).toBe("Bengaluru");
      expect(request.cityKey).toBe("bengaluru");
    });
  });

  describe("editing a request", () => {
    it("lets the requester change a pending request's details", async () => {
      const request = await ask();
      const edited = await requests.editRequest(request, { _id: "hosp1" }, {
        organisation: "org1",
        patientName: "John Smith",
        bloodGroup: "O-",
        component: "plasma",
        quantity: 300,
        priority: "urgent",
        requiredAt: null,
        location: "New location",
        contactName: "Sam",
        contactPhone: "+919000000000",
        note: "Updated",
      });
      expect(edited).toMatchObject({ patientName: "John Smith", bloodGroup: "O-", quantity: 300 });
      expect(db.read("bloodRequests", request._id)).toMatchObject({ patientName: "John Smith" });
    });

    it("keeps a field's current value when it is left out of the edit", async () => {
      const request = await ask({ patientName: "Jane Doe", location: "Original location" });
      const edited = await requests.editRequest(
        request,
        { _id: "hosp1" },
        { organisation: "org1", bloodGroup: "A+", component: "whole_blood", priority: "urgent" }
      );
      expect(edited).toMatchObject({
        patientName: "Jane Doe",
        location: "Original location",
        priority: "urgent",
      });
    });

    it("refuses to edit someone else's, or an already-answered, request", async () => {
      const request = await ask();
      const patch = {
        organisation: "org1",
        patientName: "X",
        bloodGroup: "A+",
        component: "whole_blood",
        quantity: 100,
        priority: "normal",
        requiredAt: null,
        location: "X",
        contactName: "",
        contactPhone: "",
        note: "",
      };
      expect((await rejection(requests.editRequest(request, { _id: "hosp1_evil" }, patch))).status).toBe(404);

      const rejected = await requests.rejectRequest(request, "org1", "No stock");
      expect((await rejection(requests.editRequest(rejected, { _id: "hosp1" }, patch))).status).toBe(400);
    });
  });

  describe("fulfilling, rejecting and cancelling", () => {
    it("fulfils by issuing the blood now, FEFO, and links the request to the record", async () => {
      await inventory.recordBlood({
        organisation: "org1",
        phone: DONOR.phone,
        inventoryType: "in",
        bloodGroup: "A+",
        quantity: 450,
      });
      const request = await ask();
      const fulfilled = await requests.fulfilRequest(request, "org1");
      expect(fulfilled.status).toBe("fulfilled");
      expect(fulfilled.fulfilledRecordId).toBeTruthy();
      expect(db.read("inventory", fulfilled.fulfilledRecordId)).toMatchObject({
        inventoryType: "out",
        hospital: "hosp1",
        requestId: request._id,
        quantity: 450,
      });
      expect(db.read("bloodRequests", request._id)).toMatchObject({ status: "fulfilled" });
    });

    it("fulfils a donor's or blood bank's request too, without tagging it into the wrong history", async () => {
      await inventory.recordBlood({
        organisation: "org1",
        phone: DONOR.phone,
        inventoryType: "in",
        bloodGroup: "A+",
        quantity: 450,
      });
      const request = await askAs("donor1");
      const fulfilled = await requests.fulfilRequest(request, "org1");
      expect(fulfilled.status).toBe("fulfilled");
      const record = db.read("inventory", fulfilled.fulfilledRecordId);
      expect(record).not.toHaveProperty("donar");
      expect(record).not.toHaveProperty("hospital");
      expect(record.requestId).toBe(request._id);
    });

    it("leaves the request pending when there is not enough stock", async () => {
      const request = await ask();
      const error = await rejection(requests.fulfilRequest(request, "org1"));
      expect(error.status).toBe(409);
      expect(error.message).toBe("Only 0 ML of A+ is available");
      expect(db.read("bloodRequests", request._id)).toMatchObject({ status: "pending" });
    });

    it("refuses to fulfil or reject another blood bank's request", async () => {
      const request = await ask();
      expect((await rejection(requests.fulfilRequest(request, "org2"))).status).toBe(404);
      expect((await rejection(requests.rejectRequest(request, "org2", "no"))).status).toBe(404);
    });

    it("rejects with a reason the hospital can see", async () => {
      const request = await ask();
      const rejected = await requests.rejectRequest(request, "org1", "Not enough O- for anyone right now");
      expect(rejected).toMatchObject({
        status: "rejected",
        rejectionReason: "Not enough O- for anyone right now",
      });
    });

    it("will not fulfil, reject or cancel a request that was already answered", async () => {
      const request = await ask();
      const rejected = await requests.rejectRequest(request, "org1", "No stock");
      expect((await rejection(requests.fulfilRequest(rejected, "org1"))).message).toBe(
        "This request is already rejected"
      );
      expect((await rejection(requests.rejectRequest(rejected, "org1", "again"))).status).toBe(400);
      expect((await rejection(requests.cancelRequest(rejected, "hosp1"))).status).toBe(400);
    });

    it("lets the requester cancel its own pending request, and only its own", async () => {
      const request = await ask();
      expect((await rejection(requests.cancelRequest(request, "hosp1_evil"))).status).toBe(404);
      const cancelled = await requests.cancelRequest(request, "hosp1");
      expect(cancelled.status).toBe("cancelled");
    });
  });

  describe("listing and counting", () => {
    it("lists a blood bank's incoming requests and a requester's own, newest first", async () => {
      const first = await ask({ bloodGroup: "A+" });
      const second = await ask({ bloodGroup: "O-" });
      const forBank = await requests.listRequests("organisation", "org1");
      expect(forBank.map((r) => r._id)).toEqual([second._id, first._id]);
      const forRequester = await requests.listRequests("requester", "hosp1");
      expect(forRequester).toHaveLength(2);
    });

    it("filters by status", async () => {
      const request = await ask();
      await requests.rejectRequest(request, "org1", "No stock");
      await ask(); // stays pending
      expect(await requests.listRequests("organisation", "org1", "rejected")).toHaveLength(1);
      expect(await requests.listRequests("organisation", "org1", "pending")).toHaveLength(1);
    });

    it("counts pending requests and how many are emergencies", async () => {
      await ask({ priority: "emergency" });
      await ask({ priority: "normal" });
      const answered = await ask({ priority: "emergency" });
      await requests.rejectRequest(answered, "org1", "No stock");

      expect(await requests.pendingRequestCounts()).toEqual({ pending: 2, emergency: 1 });
    });

    it("admin: lists every request across every requester", async () => {
      await askAs("hosp1");
      await askAs("donor1");
      const { requests: all, truncated } = await requests.listAllRequests();
      expect(all).toHaveLength(2);
      expect(all.map((r) => r.requesterRole).sort()).toEqual(["donar", "hospital"]);
      expect(truncated).toBe(false);
    });
  });

  describe("listNearbyRequests (the discovery feed)", () => {
    it("shows other people's pending requests from the same city, newest first, excluding the viewer's own", async () => {
      const mine = await askAs("hosp1");
      const theirs = await askAs("donor1");
      const nearby = await requests.listNearbyRequests("bengaluru", "hosp1");
      expect(nearby.map((r) => r._id)).toEqual([theirs._id]);
      expect(nearby.find((r) => r._id === mine._id)).toBeUndefined();
    });

    it("returns nothing for a viewer with no city, rather than erroring", async () => {
      await askAs("donor1");
      expect(await requests.listNearbyRequests(null, "hosp1")).toEqual([]);
      expect(await requests.listNearbyRequests(undefined, "hosp1")).toEqual([]);
    });

    it("filters by status", async () => {
      const rejected = await askAs("donor1");
      await requests.rejectRequest(rejected, "org1", "No stock");
      await askAs("donor1"); // stays pending
      expect(await requests.listNearbyRequests("bengaluru", "hosp1", "rejected")).toHaveLength(1);
    });
  });
});

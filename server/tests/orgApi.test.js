import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The real services and controllers run against the in-memory Firestore (see helpers/fakeFirestore.js); only
// the Firebase sign-in check is replaced: a bearer token is simply the account's id.
vi.mock("firebase-admin/firestore", async () => {
  const { FieldValue } = await import("./helpers/fakeFirestore.js");
  return { FieldValue };
});
vi.mock("../src/config/firebase.js", async () => {
  const { db } = await import("./helpers/fakeFirestore.js");
  const auth = { updateUser: vi.fn(), revokeRefreshTokens: vi.fn(), deleteUser: vi.fn() };
  return { getDb: () => db, getAdminAuth: () => auth };
});
vi.mock("../src/services/tokenService.js", () => ({ verifyIdToken: vi.fn(), phoneNumberOf: vi.fn() }));

const { db } = await import("./helpers/fakeFirestore.js");
const { createApp } = await import("../src/app.js");
const { verifyIdToken } = await import("../src/services/tokenService.js");

const app = createApp();
const PHONES = {
  bank1: "+911000000001",
  bank2: "+911000000002",
  bankMumbai: "+911000000003",
  hosp1: "+912000000001",
  hosp2: "+912000000002",
  donor1: "+919876543210",
  newOrg: "+913000000001",
  newOrg2: "+913000000002",
  pendingHosp: "+912000000009",
};

const person = (extra) => ({
  status: "active",
  verification: "approved",
  city: "Bengaluru",
  cityKey: "bengaluru",
  ...extra,
});
const seed = () => {
  db.reset();
  db.seed("users", {
    bank1: person({
      role: "organisation",
      organisationName: "City Blood Bank",
      phone: PHONES.bank1,
      registrationNumber: "BB-1",
      address: "1 MG Road",
    }),
    bank2: person({ role: "organisation", organisationName: "Second Blood Bank", phone: PHONES.bank2 }),
    bankMumbai: person({
      role: "organisation",
      organisationName: "Mumbai Blood Bank",
      phone: PHONES.bankMumbai,
      city: "Mumbai",
      cityKey: "mumbai",
    }),
    hosp1: person({ role: "hospital", hospitalName: "General Hospital", phone: PHONES.hosp1 }),
    hosp2: person({ role: "hospital", hospitalName: "Second Hospital", phone: PHONES.hosp2 }),
    donor1: person({ role: "donar", name: "Asha", phone: PHONES.donor1, bloodGroup: "A+" }),
    pendingHosp: person({
      role: "hospital",
      hospitalName: "Waiting Hospital",
      phone: PHONES.pendingHosp,
      verification: "pending",
      registrationNumber: "H-9",
    }),
  });
};

// `as("bank1").get("/api/org/stock")`
const as = (uid) => {
  const call = (method, url) =>
    request(app)[method](url).set("Authorization", `Bearer ${uid}`).set("Origin", "http://localhost:3102");
  return {
    get: (url) => call("get", url),
    post: (url) => call("post", url),
    patch: (url) => call("patch", url),
  };
};

// A calendar date this many days from now (an expiry date the way the website sends it).
const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const notificationsOf = (uid) =>
  [...db.collectionData("notifications").values()].filter((n) => n.recipient === uid);

beforeEach(() => {
  seed();
  verifyIdToken.mockImplementation(async (token) => ({
    uid: token,
    phone_number: PHONES[token] ?? "+910000000000",
  }));
});

const receive = (uid, body) =>
  as(uid)
    .post("/api/org/stock/receive")
    .send({ bloodGroup: "A+", quantity: 450, sourceName: "Walk-in donor", ...body });
const issue = (uid, body) =>
  as(uid)
    .post("/api/org/stock/issue")
    .send({ bloodGroup: "A+", quantity: 450, recipientName: "Patient", ...body });

describe("who may use the website API", () => {
  it("refuses a donor, with a message that says why", async () => {
    const res = await as("donor1").get("/api/org/stock");
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/hospitals and blood banks/);
    expect((await as("donor1").get("/api/org/auth/me")).status).toBe(403);
  });

  it("needs a sign-in", async () => {
    expect((await request(app).get("/api/org/dashboard")).status).toBe(401);
  });

  it("only answers browsers on the website's own origin", async () => {
    const allowed = await request(app).get("/api/org/auth/me").set("Origin", "http://localhost:3102");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3102");
    const other = await request(app).get("/api/org/auth/me").set("Origin", "http://localhost:3100");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("keeps the mobile app's door working for the same accounts", async () => {
    const res = await request(app).get("/api/v1/auth/me").set("Authorization", "Bearer bank1");
    expect(res.status).toBe(200);
    expect(res.body.user.organisationName).toBe("City Blood Bank");
  });
});

describe("registering an organisation", () => {
  const body = {
    role: "organisation",
    name: "New Blood Bank",
    registrationNumber: "KA/BB 0042",
    address: "5 Church Street",
    city: "Bengaluru",
    email: "Desk@NewBank.example",
    contactPerson: "Dr Rao",
    open24x7: true,
  };

  it("creates a pending account with its profile, and normalises the city and email", async () => {
    const res = await as("newOrg").post("/api/org/auth/register").send(body);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      role: "organisation",
      organisationName: "New Blood Bank",
      verification: "pending",
      cityKey: "bengaluru",
      email: "desk@newbank.example",
      contactPerson: "Dr Rao",
      open24x7: true,
      phone: PHONES.newOrg,
    });
    const log = [...db.collectionData("auditLogs").values()].find(
      (entry) => entry.action === "user.register"
    );
    expect(log.details.via).toBe("website");
  });

  it("does not create a donor from the website", async () => {
    const res = await as("newOrg")
      .post("/api/org/auth/register")
      .send({ ...body, role: "donar" });
    expect(res.status).toBe(400);
  });

  it("needs the registration number, an address and a valid email", async () => {
    const res = await as("newOrg")
      .post("/api/org/auth/register")
      .send({ role: "hospital", name: "X", email: "nope", city: "Pune" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors ?? {}).length + (res.body.errors?.length ?? 0)).toBeGreaterThan(0);
  });

  it("refuses a registration number that is already registered, whatever its spacing or case", async () => {
    expect((await as("newOrg").post("/api/org/auth/register").send(body)).status).toBe(201);
    const again = await as("newOrg2")
      .post("/api/org/auth/register")
      .send({ ...body, registrationNumber: "ka/bb0042" });
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/already registered/);
  });

  it("does not register the same phone number twice", async () => {
    await as("newOrg").post("/api/org/auth/register").send(body);
    const again = await as("newOrg")
      .post("/api/org/auth/register")
      .send({ ...body, registrationNumber: "OTHER-1" });
    expect(again.status).toBe(409);
  });

  it("answers with no account yet for a phone number that has not registered", async () => {
    const res = await as("newOrg").get("/api/org/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});

describe("an organisation waiting for approval", () => {
  it("can see and correct its profile but not use stock or requests", async () => {
    expect((await as("pendingHosp").get("/api/org/profile")).status).toBe(200);
    const stock = await as("pendingHosp").get("/api/org/stock");
    expect(stock.status).toBe(403);
    expect(stock.body.message).toMatch(/waiting for admin approval/);
    expect((await as("pendingHosp").get("/api/org/requests")).status).toBe(403);

    const edit = await as("pendingHosp")
      .patch("/api/org/profile")
      .send({ registrationNumber: "H-10", pincode: "560001", city: "Mysuru" });
    expect(edit.status).toBe(200);
    expect(edit.body.user).toMatchObject({
      registrationNumber: "H-10",
      pincode: "560001",
      city: "Mysuru",
      cityKey: "mysuru",
    });
  });

  it("can send a refused registration back for review, and only then", async () => {
    expect((await as("pendingHosp").post("/api/org/profile/resubmit")).status).toBe(400);
    db.read("users", "pendingHosp").verification = "rejected";
    db.read("users", "pendingHosp").verificationReason = "Licence unreadable";
    const res = await as("pendingHosp").post("/api/org/profile/resubmit");
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ verification: "pending", verificationReason: "" });
  });

  it("is told when an admin decides", async () => {
    verifyIdToken.mockImplementation(async (token) =>
      token === "admin"
        ? { uid: "admin", email: "a@x.test", admin: true }
        : { uid: token, phone_number: PHONES[token] }
    );
    const admin = (url) => request(app).post(url).set("Authorization", "Bearer admin");
    expect((await admin("/api/admin/users/pendingHosp/approve")).status).toBe(200);
    expect(
      (await admin("/api/admin/users/pendingHosp/reject").send({ reason: "Licence unreadable" })).status
    ).toBe(200);

    const list = await as("pendingHosp").get("/api/org/profile");
    expect(list.body.user.verification).toBe("rejected");
    const titles = notificationsOf("pendingHosp").map((n) => n.title);
    expect(titles).toContain("Your registration was approved");
    expect(titles).toContain("Your registration was not approved");
  });

  it("can not change the registration number after approval", async () => {
    const res = await as("bank1").patch("/api/org/profile").send({ registrationNumber: "NEW-1" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/after approval/);
  });

  it("can change other details after approval, including its name and city", async () => {
    const res = await as("bank1")
      .patch("/api/org/profile")
      .send({ name: "City Blood Centre", city: "Mysuru", hours: "9-5", open24x7: false });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      organisationName: "City Blood Centre",
      cityKey: "mysuru",
      hours: "9-5",
    });
    expect((await as("bank1").patch("/api/org/profile").send({})).status).toBe(400);
  });
});

describe("a blood bank's stock", () => {
  it("records a walk-in donation as a unit with an expiry date, and counts it in the running totals", async () => {
    const res = await receive("bank1", {
      bagNumber: "BAG-77",
      storageLocation: "Fridge 2",
      note: "camp donor",
    });
    expect(res.status).toBe(201);
    expect(res.body.record).toMatchObject({
      inventoryType: "in",
      status: "available",
      state: "available",
      remaining: 450,
      counterpartName: "Walk-in donor",
      bagNumber: "BAG-77",
      storageLocation: "Fridge 2",
      organisation: "bank1",
    });
    expect(res.body.record.unitId).toMatch(/^U-\d{8}-[0-9A-Z]+$/);
    expect(db.read("stats", "stock")["A+"].in).toBe(450);
  });

  it("records a donation from a donor with an app account against that donor's history", async () => {
    const res = await receive("bank1", { sourcePhone: PHONES.donor1, sourceName: "" });
    expect(res.status).toBe(201);
    expect(res.body.record).toMatchObject({
      donar: "donor1",
      counterpartName: "Asha",
      counterpartRole: "donar",
    });
    const mine = await request(app).get("/api/v1/inventory/mine").set("Authorization", "Bearer donor1");
    expect(mine.body.records).toHaveLength(1);
  });

  it("asks for a name when the phone number has no account", async () => {
    const res = await receive("bank1", { sourcePhone: "+919999999999", sourceName: "" });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/walk-in donor/);
    expect(await receive("bank1", { sourcePhone: "+919999999999", sourceName: "Ravi" })).toMatchObject({
      status: 201,
    });
  });

  it("uses the dates it is given, and refuses impossible ones", async () => {
    const ok = await receive("bank1", { expiresAt: inDays(30) });
    expect(ok.body.record.expiresAt).toBe(`${inDays(30)}T23:59:59.999Z`);
    expect((await receive("bank1", { expiresAt: "2001-01-01" })).body.message).toMatch(/already expired/);
    expect((await receive("bank1", { collectedAt: "2099-01-01T00:00" })).body.message).toMatch(/future/);
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    expect(
      (
        await receive("bank1", {
          collectedAt: yesterday,
          expiresAt: new Date(Date.now() - 172800000).toISOString(),
        })
      ).status
    ).toBe(400);
    expect((await receive("bank1", { expiresAt: inDays(500) })).body.message).toMatch(/more than 400 days/);
  });

  it("validates the amount and blood group", async () => {
    expect((await receive("bank1", { quantity: 0 })).status).toBe(400);
    expect((await receive("bank1", { bloodGroup: "Z+" })).status).toBe(400);
    expect((await receive("bank1", { sourceName: "" })).status).toBe(400);
  });

  it("issues first-expiring-first and never more than it has", async () => {
    await receive("bank1", { expiresAt: inDays(60) });
    await receive("bank1", { expiresAt: inDays(20) });
    const res = await issue("bank1", { quantity: 600, recipientName: "Patient Rao", reference: "Ward 4" });
    expect(res.status).toBe(201);
    const drawn = res.body.record.unitsConsumed;
    expect(drawn.map((d) => d.quantity)).toEqual([450, 150]);
    expect(res.body.record).toMatchObject({ counterpartName: "Patient Rao", reference: "Ward 4" });

    const over = await issue("bank1", { quantity: 500 });
    expect(over.status).toBe(409);
    expect(over.body.message).toBe("Only 300 ML of A+ is available");
  });

  it("issues to a hospital with an account, which then owes a confirmation of arrival", async () => {
    await receive("bank1", {});
    const res = await issue("bank1", { recipientPhone: PHONES.hosp1, recipientName: "" });
    expect(res.status).toBe(201);
    expect(res.body.record).toMatchObject({ hospital: "hosp1", counterpartName: "General Hospital" });
    expect((await issue("bank1", { recipientPhone: PHONES.donor1, recipientName: "" })).status).toBe(400);
    expect((await issue("bank1", { recipientPhone: "+919999999999", recipientName: "" })).status).toBe(404);
  });

  it("corrects a unit that is untouched, moving the running totals with it", async () => {
    const { record } = (await receive("bank1", {})).body;
    const res = await as("bank1")
      .patch(`/api/org/stock/units/${record._id}`)
      .send({ quantity: 350, bloodGroup: "B+", storageLocation: "Fridge 1" });
    expect(res.status).toBe(200);
    expect(res.body.unit).toMatchObject({
      quantity: 350,
      bloodGroup: "B+",
      storageLocation: "Fridge 1",
      remaining: 350,
    });
    expect(db.read("stats", "stock")["A+"].in).toBe(0);
    expect(db.read("stats", "stock")["B+"].in).toBe(350);
  });

  it("only allows storage and expiry changes once blood has been issued from a unit", async () => {
    const { record } = (await receive("bank1", {})).body;
    await issue("bank1", { quantity: 100 });
    const amount = await as("bank1").patch(`/api/org/stock/units/${record._id}`).send({ quantity: 300 });
    expect(amount.status).toBe(400);
    expect(amount.body.message).toMatch(/already been issued/);
    const expiry = await as("bank1")
      .patch(`/api/org/stock/units/${record._id}`)
      .send({ expiresAt: inDays(90), note: "moved" });
    expect(expiry.status).toBe(200);
    expect(expiry.body.unit).toMatchObject({
      expiresAt: `${inDays(90)}T23:59:59.999Z`,
      note: "moved",
      remaining: 350,
    });
    expect((await as("bank1").patch(`/api/org/stock/units/${record._id}`).send({})).status).toBe(400);
  });

  it("does not let one organisation see or change another's unit", async () => {
    const { record } = (await receive("bank1", {})).body;
    expect((await as("bank2").get(`/api/org/stock/units/${record._id}`)).status).toBe(404);
    expect(
      (await as("bank2").patch(`/api/org/stock/units/${record._id}`).send({ note: "mine now" })).status
    ).toBe(404);
    expect(
      (await as("bank2").post(`/api/org/stock/units/${record._id}/discard`).send({ reason: "damaged" }))
        .status
    ).toBe(404);
    expect((await as("hosp1").get(`/api/org/stock/units/${record._id}`)).status).toBe(404);
  });

  it("discards an untouched unit and takes it out of what is available", async () => {
    const { record } = (await receive("bank1", {})).body;
    const res = await as("bank1")
      .post(`/api/org/stock/units/${record._id}/discard`)
      .send({ reason: "contaminated", note: "torn bag" });
    expect(res.status).toBe(200);
    expect(res.body.unit.state).toBe("discarded");
    expect(db.read("stats", "stock")["A+"].discarded).toBe(450);
    const stock = (await as("bank1").get("/api/org/stock")).body.stock;
    expect(stock.groups.find((g) => g.bloodGroup === "A+")).toMatchObject({
      available: 0,
      totalDiscarded: 450,
      status: "out",
    });
    expect(
      (await as("bank1").post(`/api/org/stock/units/${record._id}/discard`).send({ reason: "damaged" }))
        .status
    ).toBe(400);
    expect(
      (await as("bank1").post(`/api/org/stock/units/${record._id}/discard`).send({ reason: "bored" })).status
    ).toBe(400);
  });

  it("summarises every blood group, with low and expiring stock flagged", async () => {
    await receive("bank1", { quantity: 2000 });
    await receive("bank1", { bloodGroup: "O-", quantity: 500 });
    const soon = new Date(Date.now() + 3 * 86400000).toISOString();
    await receive("bank1", { bloodGroup: "B+", quantity: 450, expiresAt: soon });
    const { stock } = (await as("bank1").get("/api/org/stock")).body;
    expect(stock.groups).toHaveLength(8);
    const group = (name) => stock.groups.find((g) => g.bloodGroup === name);
    expect(group("A+")).toMatchObject({ available: 2000, status: "ok", availableUnits: 1 });
    expect(group("O-")).toMatchObject({ available: 500, status: "low" });
    expect(group("B+")).toMatchObject({ expiringSoonMl: 450, status: "low" });
    expect(group("AB+")).toMatchObject({ available: 0, status: "out" });
    expect(stock).toMatchObject({ totalAvailable: 2950, expiringSoonMl: 450, lowStockMl: 1000 });
  });

  it("lists units with filters, sorting and paging", async () => {
    await receive("bank1", { expiresAt: inDays(90), bagNumber: "AAA" });
    await receive("bank1", {
      bloodGroup: "O+",
      expiresAt: inDays(30),
      sourceName: "Meena",
      bagNumber: "BBB",
    });
    await receive("bank1", { bloodGroup: "O+", expiresAt: inDays(60), storageLocation: "Freezer 9" });
    const get = async (query) => (await as("bank1").get(`/api/org/stock/units?${query}`)).body;

    expect((await get("")).total).toBe(3);
    expect((await get("bloodGroup=O%2B")).units).toHaveLength(2);
    expect((await get("sort=expiry")).units.map((u) => u.expiresAt.slice(0, 10))).toEqual([
      inDays(30),
      inDays(60),
      inDays(90),
    ]);
    expect((await get("q=meena")).units).toHaveLength(1);
    expect((await get("q=freezer")).units).toHaveLength(1);
    expect((await get("q=BBB")).units[0].bagNumber).toBe("BBB");
    const paged = await get("pageSize=2&page=2");
    expect(paged).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(paged.units).toHaveLength(1);
    expect((await as("bank1").get("/api/org/stock/units?state=nonsense")).status).toBe(400);
  });

  it("shows a past-expiry unit as expired until it is discarded", async () => {
    await receive("bank1", {});
    const [id] = [...db.collectionData("inventory").keys()];
    db.read("inventory", id).expiresAt = "2020-01-01T00:00:00.000Z";
    const expired = (await as("bank1").get("/api/org/stock/units?state=expired")).body;
    expect(expired.units).toHaveLength(1);
    expect(expired.units[0]).toMatchObject({ state: "expired", remaining: 450 });
    const stock = (await as("bank1").get("/api/org/stock")).body.stock;
    expect(stock).toMatchObject({ expiredUnits: 1, expiredMl: 450, totalAvailable: 0 });
    expect((await issue("bank1", { quantity: 100 })).status).toBe(409);
  });

  it("tells the owner when a blood group first drops under the low-stock line, not on every issue after", async () => {
    await receive("bank1", { quantity: 1200 });
    await issue("bank1", { quantity: 100 });
    expect(notificationsOf("bank1")).toHaveLength(0);
    await issue("bank1", { quantity: 300 });
    expect(notificationsOf("bank1").map((n) => n.title)).toEqual(["A+ is running low"]);
    await issue("bank1", { quantity: 100 });
    expect(notificationsOf("bank1")).toHaveLength(1);
    await issue("bank1", { quantity: 700 });
    expect(notificationsOf("bank1").map((n) => n.title)).toEqual(["A+ is running low"]);
  });

  it("keeps a history of every movement, and exports it safely for a spreadsheet", async () => {
    const donation = (await receive("bank1", { sourceName: '=HYPERLINK("http://evil.example")' })).body
      .record;
    await receive("bank1", { bloodGroup: "O+", sourceName: "Comma, Name" });
    await issue("bank1", { quantity: 200, recipientName: "Patient", reference: "Ward 4" });
    await as("bank1").post(`/api/org/stock/units/${donation._id}/discard`).send({ reason: "expired" }); // has issued blood: refused
    const second = [...db.collectionData("inventory").entries()].find(
      ([, unit]) => unit.bloodGroup === "O+"
    )[0];
    await as("bank1")
      .post(`/api/org/stock/units/${second}/discard`)
      .send({ reason: "damaged", note: "dropped" });

    const all = (await as("bank1").get("/api/org/stock/movements")).body;
    expect(all.movements.map((m) => m.kind).sort()).toEqual(["discarded", "issued", "received", "received"]);
    expect(all.total).toBe(4);
    const issued = (await as("bank1").get("/api/org/stock/movements?kind=issued")).body.movements;
    expect(issued).toHaveLength(1);
    expect(issued[0]).toMatchObject({
      quantity: 200,
      counterpartName: "Patient",
      reference: "Ward 4",
      bloodGroup: "A+",
    });
    expect((await as("bank1").get("/api/org/stock/movements?bloodGroup=O%2B")).body.total).toBe(2);
    expect((await as("bank1").get("/api/org/stock/movements?q=ward")).body.total).toBe(1);
    expect((await as("bank1").get("/api/org/stock/movements?from=2001-01-01&to=2001-01-02")).body.total).toBe(
      0
    );

    const csv = await as("bank1").get("/api/org/reports/movements.csv");
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect(csv.headers["content-disposition"]).toMatch(
      /attachment; filename="blood-movements-\d{4}-\d{2}-\d{2}\.csv"/
    );
    const lines = csv.text.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toBe(
      "Date and time (UTC),Type,Unit,Blood group,Quantity (ML),From / to,Phone,Reference,Reason,Note"
    );
    expect(lines).toHaveLength(5);
    expect(csv.text).toContain(`"'=HYPERLINK(""http://evil.example"")"`); // a formula is defused, quotes doubled
    expect(csv.text).toContain('"Comma, Name"');
  });

  it("keeps each organisation's history to itself", async () => {
    await receive("bank1", {});
    expect((await as("bank2").get("/api/org/stock/movements")).body.total).toBe(0);
    expect((await as("bank2").get("/api/org/stock/units")).body.total).toBe(0);
    expect((await as("bank2").get("/api/org/stock")).body.stock.totalAvailable).toBe(0);
  });

  it("records who did what in the account's activity log", async () => {
    await receive("bank1", {});
    await issue("bank1", {});
    const { logs } = (await as("bank1").get("/api/org/activity")).body;
    expect(logs.map((l) => l.action).sort()).toEqual(["inventory.add", "inventory.issue"]);
    expect((await as("bank2").get("/api/org/activity")).body.logs).toHaveLength(0);
  });
});

describe("a hospital's stock", () => {
  it("is kept apart from the blood banks' and never touches the platform totals", async () => {
    const res = await receive("hosp1", { sourceName: "Red Cross Blood Bank", quantity: 900 });
    expect(res.status).toBe(201);
    expect(db.collectionData("hospitalStock").size).toBe(1);
    expect(db.collectionData("inventory").size).toBe(0);
    expect(db.read("stats", "stock")).toBeUndefined();
    const stock = (await as("hosp1").get("/api/org/stock")).body.stock;
    expect(stock.totalAvailable).toBe(900);
    expect((await as("bank1").get("/api/org/stock")).body.stock.totalAvailable).toBe(0);
  });

  it("needs the source named, since it can only be a delivery from somewhere", async () => {
    expect((await receive("hosp1", { sourceName: "" })).status).toBe(400);
    const phoneOnly = await receive("hosp1", { sourceName: "", sourcePhone: PHONES.bank1 });
    expect(phoneOnly.status).toBe(400);
  });

  it("uses blood for a patient, first-expiring-first, without touching any blood bank record", async () => {
    await receive("hosp1", { expiresAt: inDays(60) });
    await receive("hosp1", { expiresAt: inDays(20) });
    const res = await issue("hosp1", { quantity: 500, recipientName: "Mr Sharma", reference: "OT-2" });
    expect(res.status).toBe(201);
    expect(res.body.record.unitsConsumed.map((d) => d.quantity)).toEqual([450, 50]);
    expect((await issue("hosp1", { quantity: 1000 })).status).toBe(409);
    expect(
      (await as("hosp1").get("/api/org/stock/movements")).body.movements.map((m) => m.kind).sort()
    ).toEqual(["issued", "received", "received"]);
    expect(db.collectionData("inventory").size).toBe(0);
  });

  it("can not issue to a phone number, only to a named patient", async () => {
    await receive("hosp1", {});
    expect((await issue("hosp1", { recipientName: "", recipientPhone: PHONES.hosp2 })).status).toBe(400);
  });

  it("corrects and discards its own units", async () => {
    const { record } = (await receive("hosp1", {})).body;
    const edit = await as("hosp1").patch(`/api/org/stock/units/${record._id}`).send({ quantity: 300 });
    expect(edit.body.unit.quantity).toBe(300);
    expect(db.read("stats", "stock")).toBeUndefined();
    expect(
      (await as("hosp1").post(`/api/org/stock/units/${record._id}/discard`).send({ reason: "damaged" }))
        .status
    ).toBe(200);
    expect(
      (await as("hosp1").get("/api/org/stock")).body.stock.groups.find((g) => g.bloodGroup === "A+")
        .totalDiscarded
    ).toBe(300);
  });

  describe("deliveries from a blood bank", () => {
    const sendBlood = async () => {
      await receive("bank1", { expiresAt: inDays(20) });
      await receive("bank1", { expiresAt: inDays(80) });
      return (await issue("bank1", { quantity: 600, recipientPhone: PHONES.hosp1, recipientName: "" })).body
        .record;
    };

    it("are listed as waiting until the hospital confirms they arrived", async () => {
      const record = await sendBlood();
      const list = (await as("hosp1").get("/api/org/shipments")).body.shipments;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        _id: record._id,
        quantity: 600,
        bloodGroup: "A+",
        status: "pending",
        from: { name: "City Blood Bank" },
      });
      expect(list[0].units.map((u) => u.quantity)).toEqual([450, 150]);
      expect((await as("hosp1").get("/api/org/stock")).body.stock.totalAvailable).toBe(0);
      expect((await as("hosp1").get("/api/org/shipments?status=received")).body.shipments).toHaveLength(0);
      expect((await as("hosp2").get("/api/org/shipments")).body.shipments).toHaveLength(0);
    });

    it("become the hospital's own units, with the blood bank's expiry dates, once confirmed", async () => {
      const record = await sendBlood();
      const res = await as("hosp1").post(`/api/org/shipments/${record._id}/receive`);
      expect(res.status).toBe(201);
      expect(res.body.units).toHaveLength(2);

      const units = (await as("hosp1").get("/api/org/stock/units?sort=expiry")).body.units;
      expect(units.map((u) => [u.quantity, u.expiresAt.slice(0, 10), u.counterpartName])).toEqual([
        [450, inDays(20), "City Blood Bank"],
        [150, inDays(80), "City Blood Bank"],
      ]);
      expect((await as("hosp1").get("/api/org/stock")).body.stock.totalAvailable).toBe(600);
      expect(
        (await as("hosp1").get("/api/org/shipments?status=received")).body.shipments[0].receipt.receivedBy
      ).toBe("hosp1");
      // the blood bank sees its record was delivered
      const bankLine = (await as("bank1").get("/api/org/stock/movements?kind=issued")).body.movements[0];
      expect(bankLine.receipt).toMatchObject({ receivedBy: "hosp1" });
    });

    it("can only be confirmed once, and only by the hospital they were issued to", async () => {
      const record = await sendBlood();
      expect((await as("hosp2").post(`/api/org/shipments/${record._id}/receive`)).status).toBe(404);
      expect((await as("hosp1").post(`/api/org/shipments/${record._id}/receive`)).status).toBe(201);
      expect((await as("hosp1").post(`/api/org/shipments/${record._id}/receive`)).status).toBe(409);
      expect((await as("hosp1").get("/api/org/stock")).body.stock.totalAvailable).toBe(600);
      expect((await as("bank1").post(`/api/org/shipments/${record._id}/receive`)).status).toBe(403);
      expect((await as("bank1").get("/api/org/shipments")).status).toBe(403);
    });
  });
});

const raise = (uid, body = {}) =>
  as(uid)
    .post("/api/org/requests")
    .send({
      patientName: "Jane Doe",
      bloodGroup: "A+",
      quantity: 450,
      priority: "normal",
      location: "General Hospital, Ward 3",
      ...body,
    });

describe("blood requests", () => {
  it("reach every other hospital and blood bank in the requester's city, from any door", async () => {
    // raised from the mobile app by a donor
    const created = await request(app).post("/api/v1/requests").set("Authorization", "Bearer donor1").send({
      patientName: "Jane Doe",
      bloodGroup: "A+",
      quantity: 900,
      priority: "emergency",
      location: "City Hospital",
    });
    expect(created.status).toBe(201);

    for (const uid of ["bank1", "bank2", "hosp1", "hosp2"]) {
      const titles = notificationsOf(uid).map((n) => n.title);
      expect(titles).toEqual(["Emergency: 900 ML A+ needed in Bengaluru"]);
    }
    expect(notificationsOf("bankMumbai")).toHaveLength(0); // another city
    expect(notificationsOf("pendingHosp")).toHaveLength(0); // not approved
    expect(notificationsOf("donor1")).toHaveLength(0);

    const rows = (await as("bank1").get("/api/org/requests")).body;
    expect(rows.requests).toHaveLength(1);
    expect(rows.requests[0]).toMatchObject({
      relation: "city",
      priority: "emergency",
      actions: expect.arrayContaining(["respond", "dismiss"]),
      needsAction: true,
      requester: { name: "Asha" },
    });
    expect(rows.stats).toMatchObject({ total: 1, needsAction: 1, open: 1, city: 1, mine: 0, emergency: 1 });
    expect((await as("bankMumbai").get("/api/org/requests")).body.requests).toHaveLength(0);
  });

  it("can be raised from the website, and are shown to the organisation's own city but not to itself", async () => {
    const res = await raise("hosp1", { priority: "urgent" });
    expect(res.status).toBe(201);
    expect(res.body.request).toMatchObject({
      city: "Bengaluru",
      cityKey: "bengaluru",
      requester: "hosp1",
      status: "pending",
      unitsRequired: 1,
    });
    expect(notificationsOf("hosp1")).toHaveLength(0);
    expect(notificationsOf("bank1")).toHaveLength(1);

    const mine = (await as("hosp1").get("/api/org/requests")).body.requests;
    expect(mine[0]).toMatchObject({ relation: "mine", actions: ["edit", "cancel"] });
  });

  it("needs a city to be raised from, and valid details", async () => {
    db.read("users", "hosp1").city = "";
    delete db.read("users", "hosp1").cityKey;
    const res = await raise("hosp1");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/city/);
    expect((await raise("bank1", { quantity: -5 })).status).toBe(400);
  });

  it("are filtered, searched, sorted and paged", async () => {
    await raise("hosp1", {
      bloodGroup: "O-",
      priority: "emergency",
      patientName: "Alpha",
      requiredAt: `${inDays(40)}T10:00`,
    });
    await raise("hosp1", {
      bloodGroup: "A+",
      patientName: "Bravo",
      location: "Mercy Clinic",
      requiredAt: `${inDays(10)}T10:00`,
    });
    await raise("hosp2", { bloodGroup: "A+", priority: "urgent", patientName: "Charlie" });
    const list = async (query) => (await as("bank1").get(`/api/org/requests?${query}`)).body;

    expect((await list("")).total).toBe(3);
    expect((await list("bloodGroup=A%2B")).total).toBe(2);
    expect((await list("priority=emergency")).requests[0].patientName).toBe("Alpha");
    expect((await list("q=mercy")).total).toBe(1);
    expect((await list("q=general hospital")).total).toBe(3); // requester name
    expect((await list("sort=priority")).requests.map((r) => r.patientName)).toEqual([
      "Alpha",
      "Charlie",
      "Bravo",
    ]);
    expect((await list("sort=needed")).requests[0].patientName).toBe("Bravo");
    expect((await list("pageSize=2&page=2")).requests).toHaveLength(1);
    expect((await list("relation=mine")).total).toBe(0);
    expect((await list("status=pending")).total).toBe(3);
    expect((await list("status=fulfilled")).total).toBe(0);
    expect((await list("from=2001-01-01&to=2001-01-02")).total).toBe(0);
    expect((await as("bank1").get("/api/org/requests?priority=whenever")).status).toBe(400);
  });

  it("shows a past needed-by date as expired and does not ask for action on it", async () => {
    await raise("hosp1", { requiredAt: `${inDays(40)}T10:00` });
    const [id] = [...db.collectionData("bloodRequests").keys()];
    db.read("bloodRequests", id).requiredAt = "2020-01-01T00:00:00.000Z";
    const rows = (await as("bank1").get("/api/org/requests")).body;
    expect(rows.requests[0]).toMatchObject({ expired: true, needsAction: false });
    expect(rows.stats).toMatchObject({ open: 0, needsAction: 0 });
    expect((await as("bank1").get("/api/org/requests?status=expired")).body.total).toBe(1);
  });

  it("can be hidden from an organisation's own list and brought back", async () => {
    const { request: made } = (await raise("hosp1")).body;
    expect((await as("bank1").post(`/api/org/requests/${made._id}/dismiss`)).status).toBe(200);
    expect((await as("bank1").get("/api/org/requests")).body.requests).toHaveLength(0);
    expect((await as("bank1").get("/api/org/requests?dismissed=1")).body.requests[0]).toMatchObject({
      dismissed: true,
      actions: ["restore"],
    });
    expect((await as("bank2").get("/api/org/requests")).body.requests).toHaveLength(1); // nobody else is affected
    expect((await as("bank1").post(`/api/org/requests/${made._id}/restore`)).status).toBe(200);
    expect((await as("bank1").get("/api/org/requests")).body.requests).toHaveLength(1);
    expect((await as("hosp1").post(`/api/org/requests/${made._id}/dismiss`)).status).toBe(400); // own request
  });

  it("only show their detail to the requester, the named blood bank, its city and those who answered", async () => {
    const { request: made } = (await raise("hosp1")).body;
    const detail = await as("bank1").get(`/api/org/requests/${made._id}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      request: { relation: "city", patientName: "Jane Doe", requester: { hospitalName: "General Hospital" } },
      stock: { bloodGroup: "A+", availableMl: 0, neededMl: 450 },
      responses: [],
      myResponse: null,
    });
    expect(detail.body.timeline.map((e) => e.kind)).toEqual(["created"]);
    expect((await as("bankMumbai").get(`/api/org/requests/${made._id}`)).status).toBe(404);
    expect((await as("bank1").get("/api/org/requests/does-not-exist")).status).toBe(404);
  });

  describe("offering blood", () => {
    let made;
    beforeEach(async () => {
      made = (await raise("hosp1", { quantity: 900 })).body.request; // 2 units
    });

    it("is refused when the organisation does not have the stock", async () => {
      const res = await as("bank1").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 1 });
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("You only have 0 ML of A+ in stock, 450 ML would be needed");
    });

    it("tells the requester, and shows the offer on both sides", async () => {
      await receive("bank1", { quantity: 900 });
      const res = await as("bank1").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 2 });
      expect(res.status).toBe(201);
      expect(res.body.response).toMatchObject({ responderId: "bank1", unitsOffered: 2, status: "pending" });
      expect(notificationsOf("hosp1").map((n) => n.title)).toEqual(["City Blood Bank offered 2 units"]);

      const mine = (await as("hosp1").get(`/api/org/requests/${made._id}`)).body;
      expect(mine.responses).toHaveLength(1);
      expect(mine.responses[0].responderId).toMatchObject({ organisationName: "City Blood Bank" });
      expect(mine.request).toMatchObject({
        pendingResponses: 1,
        actions: expect.arrayContaining(["review-offers"]),
      });
      const theirs = (await as("bank1").get(`/api/org/requests/${made._id}`)).body;
      expect(theirs.myResponse).toMatchObject({ status: "pending", unitsOffered: 2 });
      expect(theirs.request.actions).toEqual(["withdraw"]);
      expect(theirs.responses).toEqual([]); // others' offers are never shown
      expect((await as("hosp1").get("/api/org/requests")).body.requests[0].pendingResponses).toBe(1);
      expect((await as("hosp1").get("/api/org/requests")).body.stats.needsAction).toBe(1);
    });

    it("can be made once, withdrawn, and is refused on one's own request", async () => {
      await receive("bank1", { quantity: 900 });
      const first = await as("bank1").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 1 });
      expect(
        (await as("bank1").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 1 })).status
      ).toBe(409);
      expect(
        (await as("hosp1").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 1 })).status
      ).toBe(400);
      expect(
        (await as("bank1").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 0 })).status
      ).toBe(400);
      expect(
        (
          await as("bank1").post(
            `/api/org/requests/${made._id}/responses/${first.body.response._id}/withdraw`
          )
        ).status
      ).toBe(200);
      expect(
        (await as("bank1").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 1 })).status
      ).toBe(201);
    });

    it("is not possible for an organisation in another city", async () => {
      await receive("bankMumbai", { quantity: 900 });
      const res = await as("bankMumbai")
        .post(`/api/org/requests/${made._id}/offer`)
        .send({ unitsOffered: 1 });
      expect(res.status).toBe(404);
    });

    it("is declined or confirmed by the requester, and the responder is told", async () => {
      await receive("bank1", { quantity: 900 });
      await receive("bank2", { quantity: 900 });
      const a = (await as("bank1").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 1 })).body
        .response;
      const b = (await as("bank2").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 1 })).body
        .response;
      expect(
        (await as("bank1").post(`/api/org/requests/${made._id}/responses/${a._id}/confirm`)).status
      ).toBe(404); // not the requester
      expect(
        (await as("hosp1").post(`/api/org/requests/${made._id}/responses/${a._id}/confirm`)).status
      ).toBe(200);
      expect(
        (await as("hosp1").post(`/api/org/requests/${made._id}/responses/${b._id}/decline`)).status
      ).toBe(200);
      expect(notificationsOf("bank1").map((n) => n.title)).toContain("Your offer was confirmed");
      expect(notificationsOf("bank2").map((n) => n.title)).toContain("Your offer was declined");
    });
  });

  describe("issuing blood for a confirmed offer", () => {
    let made;
    let offer;
    beforeEach(async () => {
      await receive("bank1", { quantity: 450, expiresAt: inDays(20) });
      await receive("bank1", { quantity: 450, expiresAt: inDays(80) });
      made = (await raise("hosp1", { quantity: 900 })).body.request;
      offer = (await as("bank1").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 2 })).body
        .response;
    });
    const dispatch = (uid = "bank1") =>
      as(uid).post(`/api/org/requests/${made._id}/responses/${offer._id}/dispatch`);
    const confirm = () => as("hosp1").post(`/api/org/requests/${made._id}/responses/${offer._id}/confirm`);

    it("waits for the requester to confirm the offer", async () => {
      const res = await dispatch();
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/confirmed/);
    });

    it("draws the stock, marks the offer, tells the requester and creates a delivery for a hospital", async () => {
      await confirm();
      const rows = (await as("bank1").get("/api/org/requests")).body.requests;
      expect(rows[0]).toMatchObject({ status: "fulfilled", actions: ["dispatch"], needsAction: true });

      const res = await dispatch();
      expect(res.status).toBe(200);
      expect(res.body.response).toMatchObject({ dispatchedMl: 900, dispatchedRecordId: expect.any(String) });
      expect(res.body.record).toMatchObject({
        inventoryType: "out",
        quantity: 900,
        requestId: made._id,
        hospital: "hosp1",
      });

      expect((await as("bank1").get("/api/org/stock")).body.stock.totalAvailable).toBe(0);
      expect(notificationsOf("hosp1").map((n) => n.title)).toContain("City Blood Bank issued 900 ML of A+");
      expect((await as("bank1").get("/api/org/requests")).body.requests[0].actions).toEqual([]);
      expect((await as("hosp1").get("/api/org/shipments")).body.shipments[0]).toMatchObject({
        quantity: 900,
        requestId: made._id,
        status: "pending",
      });
      const timeline = (await as("bank1").get(`/api/org/requests/${made._id}`)).body.timeline.map(
        (e) => e.kind
      );
      expect(timeline).toEqual(
        expect.arrayContaining(["created", "offer", "confirmed", "dispatched", "fulfilled"])
      );
    });

    it("can not be done twice, or by anyone but the responder", async () => {
      await confirm();
      expect((await dispatch("bank2")).status).toBe(404);
      expect((await dispatch("hosp1")).status).toBe(404);
      expect((await dispatch()).status).toBe(200);
      const again = await dispatch();
      expect(again.status).toBe(409);
      expect((await as("bank1").get("/api/org/stock")).body.stock.totalAvailable).toBe(0);
      expect((await as("bank1").get("/api/org/stock/movements?kind=issued")).body.total).toBe(1);
    });

    it("fails whole, leaving the offer open, when the stock has gone", async () => {
      await confirm();
      await issue("bank1", { quantity: 600 });
      const res = await dispatch();
      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Only 300 ML of A+ is available");
      expect(db.collectionData("requestResponses").get(offer._id).dispatchedRecordId).toBeUndefined();
      await receive("bank1", { quantity: 600 });
      expect((await dispatch()).status).toBe(200);
    });

    it("is refused once the request was cancelled", async () => {
      await confirm();
      // a request that has been fulfilled can no longer be cancelled, so cancel a fresh one
      const other = (await raise("hosp1", { quantity: 450 })).body.request;
      const o = (await as("bank1").post(`/api/org/requests/${other._id}/offer`).send({ unitsOffered: 1 }))
        .body.response;
      await as("hosp1").post(`/api/org/requests/${other._id}/responses/${o._id}/confirm`);
      db.read("bloodRequests", other._id).status = "cancelled";
      const res = await as("bank1").post(`/api/org/requests/${other._id}/responses/${o._id}/dispatch`);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cancelled/);
    });
  });

  describe("sent straight to a blood bank", () => {
    it("can be fulfilled from stock or rejected with a reason, and the requester is told", async () => {
      await receive("bank1", { quantity: 450 });
      const direct = (await raise("hosp1", { organisation: "bank1" })).body.request;
      const row = (await as("bank1").get("/api/org/requests")).body.requests[0];
      expect(row).toMatchObject({
        relation: "addressed",
        actions: expect.arrayContaining(["fulfil", "reject", "respond"]),
      });
      expect(notificationsOf("bank1")).toHaveLength(1);

      expect((await as("hosp2").post(`/api/org/requests/${direct._id}/fulfil`)).status).toBe(403); // hospitals never fulfil
      expect((await as("bank2").post(`/api/org/requests/${direct._id}/fulfil`)).status).toBe(404); // not its request
      const res = await as("bank1").post(`/api/org/requests/${direct._id}/fulfil`);
      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe("fulfilled");
      expect((await as("bank1").get("/api/org/stock")).body.stock.totalAvailable).toBe(0);
      expect(notificationsOf("hosp1").map((n) => n.title)).toContain("Your blood request was fulfilled");

      const second = (await raise("hosp1", { organisation: "bank1" })).body.request;
      expect((await as("bank1").post(`/api/org/requests/${second._id}/reject`).send({})).status).toBe(400);
      expect(
        (await as("bank1").post(`/api/org/requests/${second._id}/reject`).send({ reason: "No stock" })).status
      ).toBe(200);
      expect(notificationsOf("hosp1").map((n) => n.title)).toContain(
        "Your blood request was rejected: No stock"
      );
    });

    it("stays pending when there is not enough stock", async () => {
      const direct = (await raise("hosp1", { organisation: "bank1" })).body.request;
      const res = await as("bank1").post(`/api/org/requests/${direct._id}/fulfil`);
      expect(res.status).toBe(409);
      expect((await as("hosp1").get(`/api/org/requests/${direct._id}`)).body.request.status).toBe("pending");
    });
  });

  it("tells everyone with an open offer when the requester cancels", async () => {
    await receive("bank1", { quantity: 450 });
    const made = (await raise("hosp1")).body.request;
    await as("bank1").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 1 });
    expect((await as("hosp1").post(`/api/org/requests/${made._id}/cancel`)).status).toBe(200);
    expect(notificationsOf("bank1").map((n) => n.title)).toContain(
      "A request you offered to help with was cancelled"
    );
    expect(notificationsOf("bank2").map((n) => n.title)).not.toContain(
      "A request you offered to help with was cancelled"
    );
    expect((await as("bank1").post(`/api/org/requests/${made._id}/cancel`)).status).toBe(404);
  });

  it("are exported for the period", async () => {
    await raise("hosp1", { patientName: "=cmd|' /C calc'!A0" });
    const csv = await as("bank1").get("/api/org/reports/requests.csv");
    expect(csv.status).toBe(200);
    const lines = csv.text.replace("﻿", "").trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Raised \(UTC\),Blood group,Quantity \(ML\)/);
    expect(lines[1]).toContain("'=cmd");
    expect(lines[1]).toContain("General Hospital");
  });
});

describe("notifications", () => {
  beforeEach(async () => {
    await raise("hosp1");
    await raise("hosp2");
  });

  it("lists the account's own, newest first, with the unread count", async () => {
    const res = await as("bank1").get("/api/org/notifications");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, unread: 2 });
    expect(res.body.notifications[0]).toMatchObject({
      type: "request.new",
      read: false,
      link: { type: "request", id: expect.any(String) },
    });
    expect((await as("bank2").get("/api/org/notifications")).body.total).toBe(2);
    expect((await as("bankMumbai").get("/api/org/notifications")).body.total).toBe(0);
    expect((await as("bank1").get("/api/org/notifications?limit=1")).body.notifications).toHaveLength(1);
  });

  it("are marked read one at a time, or all at once, only by their owner", async () => {
    const [first, second] = (await as("bank1").get("/api/org/notifications")).body.notifications;
    expect((await as("bank2").post(`/api/org/notifications/${first._id}/read`)).status).toBe(404);
    expect((await as("bank1").post(`/api/org/notifications/${first._id}/read`)).status).toBe(200);
    let list = (await as("bank1").get("/api/org/notifications")).body;
    expect(list.unread).toBe(1);
    expect(
      (await as("bank1").get("/api/org/notifications?unread=1")).body.notifications.map((n) => n._id)
    ).toEqual([second._id]);
    expect((await as("bank1").post("/api/org/notifications/read-all")).body.updated).toBe(1);
    list = (await as("bank1").get("/api/org/notifications")).body;
    expect(list.unread).toBe(0);
    expect((await as("bank2").get("/api/org/notifications")).body.unread).toBe(2);
    expect((await as("bank1").post("/api/org/notifications/nope/read")).status).toBe(404);
  });
});

describe("the dashboard", () => {
  it("brings stock, requests, deliveries and things to look at into one answer", async () => {
    await receive("bank1", { quantity: 450 });
    await receive("bank1", { bloodGroup: "O+", quantity: 5000 });
    await issue("bank1", { quantity: 100 });
    await raise("hosp1", { priority: "emergency", bloodGroup: "B-" });
    const res = await as("bank1").get("/api/org/dashboard");
    expect(res.status).toBe(200);
    const { dashboard } = res.body;

    expect(dashboard.stock.totalAvailable).toBe(5350);
    expect(dashboard.requests).toMatchObject({
      needsAction: 1,
      open: 1,
      emergency: 1,
      mineOpen: 0,
      toIssue: 0,
    });
    expect(dashboard.requests.urgent[0]).toMatchObject({ bloodGroup: "B-", priority: "emergency" });
    expect(dashboard.today).toMatchObject({ received: 5450, issued: 100, discarded: 0, movements: 3 });
    expect(dashboard.trend).toHaveLength(14);
    expect(dashboard.trend[13]).toMatchObject({ in: 5450, out: 100 });
    expect(dashboard.recentMovements).toHaveLength(3);
    const titles = dashboard.attention.map((a) => a.title);
    expect(titles).toEqual(
      expect.arrayContaining(["1 emergency request in your city", "1 blood group running low"])
    );
    expect(dashboard.attention[0].severity).toBe("critical");
  });

  it("counts a hospital's deliveries still to confirm", async () => {
    await receive("bank1", {});
    await issue("bank1", { recipientPhone: PHONES.hosp1, recipientName: "" });
    const { dashboard } = (await as("hosp1").get("/api/org/dashboard")).body;
    expect(dashboard.deliveriesToConfirm).toBe(1);
    expect(dashboard.attention.map((a) => a.title)).toContain("1 delivery to confirm");
  });

  it("is empty but well-formed for a brand new account", async () => {
    const { dashboard } = (await as("bank2").get("/api/org/dashboard")).body;
    expect(dashboard.stock.totalAvailable).toBe(0);
    expect(dashboard.recentMovements).toEqual([]);
    expect(dashboard.trend.every((point) => point.in === 0 && point.out === 0)).toBe(true);
  });
});

describe("exports follow the list's filters", () => {
  it("exports only the movements that match", async () => {
    await receive("bank1", { sourceName: "Alpha donor" });
    await receive("bank1", { bloodGroup: "O+", sourceName: "Beta donor" });
    const csv = await as("bank1").get("/api/org/reports/movements.csv?bloodGroup=O%2B&kind=received");
    const lines = csv.text.replace("﻿", "").trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Beta donor");
    expect((await as("bank1").get("/api/org/reports/movements.csv?kind=nonsense")).status).toBe(400);
  });

  it("exports only the requests that match", async () => {
    await raise("hosp1", { bloodGroup: "O-", patientName: "Alpha" });
    await raise("hosp1", { bloodGroup: "A+", patientName: "Bravo" });
    const csv = await as("bank1").get("/api/org/reports/requests.csv?bloodGroup=O-");
    const lines = csv.text.replace("﻿", "").trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Alpha");
  });
});

describe("offering again", () => {
  it("is possible after a withdrawn or declined offer, and offered again in the list", async () => {
    await receive("bank1", { quantity: 900 });
    const made = (await raise("hosp1", { quantity: 450 })).body.request;
    const first = (await as("bank1").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 1 }))
      .body.response;
    expect((await as("bank1").get("/api/org/requests")).body.requests[0].actions).toEqual(["withdraw"]);

    await as("bank1").post(`/api/org/requests/${made._id}/responses/${first._id}/withdraw`);
    const row = (await as("bank1").get("/api/org/requests")).body.requests[0];
    expect(row.actions).toEqual(expect.arrayContaining(["respond", "dismiss"]));
    expect(row.needsAction).toBe(true);

    const second = await as("bank1").post(`/api/org/requests/${made._id}/offer`).send({ unitsOffered: 1 });
    expect(second.status).toBe(201);
    await as("hosp1").post(`/api/org/requests/${made._id}/responses/${second.body.response._id}/decline`);
    expect((await as("bank1").get(`/api/org/requests/${made._id}`)).body.request.actions).toEqual(
      expect.arrayContaining(["respond"])
    );
  });
});

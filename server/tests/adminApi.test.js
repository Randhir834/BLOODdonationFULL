import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/tokenService.js", () => ({ verifyIdToken: vi.fn(), phoneNumberOf: vi.fn() }));
vi.mock("../src/services/auditService.js", () => ({ record: vi.fn(), list: vi.fn() }));
vi.mock("../src/services/adminAccountService.js", () => ({
  createAdminAccount: vi.fn(),
  listAdminAccounts: vi.fn(),
  removeAdminAccount: vi.fn(),
}));
vi.mock("../src/services/dashboardService.js", () => ({
  getDashboard: vi.fn(),
  clearDashboardCache: vi.fn(),
}));
vi.mock("../src/services/userService.js", async (importOriginal) => ({
  ...(await importOriginal()),
  findUserById: vi.fn(),
  listUsers: vi.fn(),
  updateUser: vi.fn(),
  setUserStatus: vi.fn(),
  setVerification: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("../src/services/inventoryService.js", async (importOriginal) => ({
  ...(await importOriginal()),
  listRecords: vi.fn(),
  deleteRecord: vi.fn(),
  populate: vi.fn(async (records) => records),
  findRecords: vi.fn(),
  organisationTotals: vi.fn(),
}));
vi.mock("../src/services/requestService.js", async (importOriginal) => ({
  ...(await importOriginal()),
  listAllRequests: vi.fn(),
  findRequestById: vi.fn(),
}));
vi.mock("../src/services/responseService.js", async (importOriginal) => ({
  ...(await importOriginal()),
  listResponsesForRequest: vi.fn(),
}));

const { createApp } = await import("../src/app.js");
const { verifyIdToken } = await import("../src/services/tokenService.js");
const audit = await import("../src/services/auditService.js");
const accounts = await import("../src/services/adminAccountService.js");
const dashboard = await import("../src/services/dashboardService.js");
const users = await import("../src/services/userService.js");
const inventory = await import("../src/services/inventoryService.js");
const requestService = await import("../src/services/requestService.js");
const responseService = await import("../src/services/responseService.js");
const { HttpError } = await import("../src/utils/HttpError.js");

const app = createApp();
const authed = (req) => req.set("Authorization", "Bearer test-token");

const admin = { uid: "admin1", email: "boss@example.com" };
const user = (id, overrides = {}) => ({
  _id: String(id),
  role: "donar",
  name: `User ${id}`,
  phone: `+91987650000${id}`,
  address: "Delhi",
  createdAt: `2026-09-0${id}T10:00:00.000Z`,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  verifyIdToken.mockResolvedValue({ uid: admin.uid, email: admin.email, admin: true });
  inventory.populate.mockImplementation(async (records) => records);
});

describe("admin authentication", () => {
  it("requires a token", async () => {
    expect((await request(app).get("/api/admin/me")).status).toBe(401);
  });

  it("refuses a valid account that is not an admin", async () => {
    verifyIdToken.mockResolvedValue({ uid: "u1", phone_number: "+919876543210" });
    const res = await authed(request(app).get("/api/admin/me"));
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("This account is not an admin");
  });

  it("returns who is signed in", async () => {
    const res = await authed(request(app).get("/api/admin/me"));
    expect(res.body).toEqual({ success: true, admin });
  });

  it("only allows the admin website origin", async () => {
    const allowed = await request(app)
      .options("/api/admin/me")
      .set("Origin", "http://localhost:3101")
      .set("Access-Control-Request-Method", "GET");
    const userSite = await request(app)
      .options("/api/admin/me")
      .set("Origin", "http://localhost:3100")
      .set("Access-Control-Request-Method", "GET");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3101");
    expect(userSite.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("users", () => {
  beforeEach(() => {
    users.listUsers.mockResolvedValue({
      users: [
        user(3),
        user(2, { role: "hospital", hospitalName: "City Hospital", status: "suspended" }),
        user(1),
      ],
      truncated: false,
    });
  });

  it("filters, searches and pages the list", async () => {
    const all = await authed(request(app).get("/api/admin/users?pageSize=2"));
    expect(all.body).toMatchObject({ total: 3, page: 1, pageSize: 2, truncated: false });
    expect(all.body.users).toHaveLength(2);
    expect(all.body.users.every((u) => u.status)).toBe(true);

    const suspended = await authed(request(app).get("/api/admin/users?status=suspended"));
    expect(suspended.body.users.map((u) => u._id)).toEqual(["2"]);

    const search = await authed(request(app).get("/api/admin/users?q=city%20hospital"));
    expect(search.body.users.map((u) => u._id)).toEqual(["2"]);
  });

  it("treats empty filters from the website as unset", async () => {
    const res = await authed(request(app).get("/api/admin/users?role=&status=&q=&page=1&pageSize=25"));
    expect(res.status).toBe(200);
    expect(users.listUsers).toHaveBeenCalledWith(undefined);
  });

  it("rejects an invalid filter", async () => {
    expect((await authed(request(app).get("/api/admin/users?role=king"))).status).toBe(400);
  });

  it("answers 404 for a missing user", async () => {
    users.findUserById.mockResolvedValue(null);
    expect((await authed(request(app).get("/api/admin/users/missing"))).status).toBe(404);
  });

  it("refuses an id that would change the Firestore path", async () => {
    const res = await authed(request(app).get("/api/admin/users/a%2Fb"));
    expect(res.status).toBe(400);
    expect(users.findUserById).not.toHaveBeenCalled();
  });

  it("edits a user and writes the change to the activity log", async () => {
    const before = user(1);
    const after = { ...before, name: "New Name" };
    users.findUserById.mockResolvedValue(before);
    users.updateUser.mockResolvedValue(after);
    const res = await authed(request(app).patch("/api/admin/users/1")).send({
      name: "New Name",
      _id: "hack",
    });
    expect(res.status).toBe(200);
    expect(users.updateUser).toHaveBeenCalledWith("1", { name: "New Name" });
    expect(audit.record).toHaveBeenCalledWith(
      admin,
      "user.update",
      expect.objectContaining({ type: "user", id: "1" }),
      {
        before: expect.objectContaining({ name: "User 1" }),
        after: expect.objectContaining({ name: "New Name" }),
      }
    );
  });

  it("needs a reason to suspend", async () => {
    users.findUserById.mockResolvedValue(user(1));
    const res = await authed(request(app).post("/api/admin/users/1/suspend")).send({ reason: "  " });
    expect(res.status).toBe(400);
    expect(users.setUserStatus).not.toHaveBeenCalled();
  });

  it("suspends and reactivates", async () => {
    users.findUserById.mockResolvedValue(user(1));
    users.setUserStatus.mockResolvedValue(user(1, { status: "suspended" }));
    const suspended = await authed(request(app).post("/api/admin/users/1/suspend")).send({ reason: "Spam" });
    expect(suspended.status).toBe(200);
    expect(users.setUserStatus).toHaveBeenCalledWith("1", "suspended", "Spam");

    users.setUserStatus.mockResolvedValue(user(1, { status: "active" }));
    await authed(request(app).post("/api/admin/users/1/reactivate"));
    expect(users.setUserStatus).toHaveBeenLastCalledWith("1", "active");
    expect(audit.record).toHaveBeenCalledTimes(2);
  });

  it("deletes a user", async () => {
    users.findUserById.mockResolvedValue(user(1));
    const res = await authed(request(app).delete("/api/admin/users/1"));
    expect(res.status).toBe(200);
    expect(users.deleteUser).toHaveBeenCalledWith("1");
  });
});

describe("approving hospitals and blood banks", () => {
  const waiting = user(2, {
    role: "organisation",
    organisationName: "City Blood Bank",
    registrationNumber: "KA/BB/2041",
    verification: "pending",
  });

  it("lists who is waiting for approval and counts profiles without a state as approved", async () => {
    users.listUsers.mockResolvedValue({
      users: [
        user(3), // a donor, no `verification` on the profile
        waiting,
        user(1, { role: "hospital", hospitalName: "General", verification: "rejected" }),
      ],
      truncated: false,
    });
    const ids = async (query) =>
      (await authed(request(app).get(`/api/admin/users?${query}`))).body.users.map((u) => u._id);

    expect(await ids("verification=pending")).toEqual(["2"]);
    expect(await ids("verification=rejected")).toEqual(["1"]);
    expect(await ids("verification=approved")).toEqual(["3"]);
    expect(await ids("")).toEqual(["3", "2", "1"]);
    expect((await authed(request(app).get("/api/admin/users?verification=maybe"))).status).toBe(400);
  });

  it("approves an account and writes it to the activity log", async () => {
    users.findUserById.mockResolvedValue(waiting);
    users.setVerification.mockResolvedValue({ ...waiting, verification: "approved" });
    const res = await authed(request(app).post("/api/admin/users/2/approve"));
    expect(res.status).toBe(200);
    expect(res.body.user.verification).toBe("approved");
    expect(users.setVerification).toHaveBeenCalledWith("2", "approved", { adminEmail: admin.email });
    expect(audit.record).toHaveBeenCalledWith(
      admin,
      "user.approve",
      { type: "user", id: "2", label: "City Blood Bank" },
      { registrationNumber: "KA/BB/2041" }
    );
  });

  it("needs a reason to reject", async () => {
    users.findUserById.mockResolvedValue(waiting);
    const res = await authed(request(app).post("/api/admin/users/2/reject")).send({ reason: "  " });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Please give a reason");
    expect(users.setVerification).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("rejects an account with a reason that is kept in the activity log", async () => {
    users.findUserById.mockResolvedValue(waiting);
    users.setVerification.mockResolvedValue({ ...waiting, verification: "rejected" });
    const res = await authed(request(app).post("/api/admin/users/2/reject")).send({
      reason: "Licence number could not be verified",
    });
    expect(res.status).toBe(200);
    expect(users.setVerification).toHaveBeenCalledWith("2", "rejected", {
      reason: "Licence number could not be verified",
      adminEmail: admin.email,
    });
    expect(audit.record).toHaveBeenCalledWith(
      admin,
      "user.reject",
      expect.objectContaining({ type: "user", id: "2" }),
      { reason: "Licence number could not be verified" }
    );
  });

  it("answers 404 for a missing user and 400 for a donor", async () => {
    users.findUserById.mockResolvedValue(null);
    expect((await authed(request(app).post("/api/admin/users/nope/approve"))).status).toBe(404);

    users.findUserById.mockResolvedValue(user(1));
    users.setVerification.mockRejectedValue(new HttpError(400, "Donors do not need approval"));
    const res = await authed(request(app).post("/api/admin/users/1/approve"));
    expect(res.status).toBe(400);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("never lets a phone-number user approve anyone, not even themselves", async () => {
    verifyIdToken.mockResolvedValue({ uid: "org1", phone_number: "+919876543210" });
    const approve = await authed(request(app).post("/api/admin/users/org1/approve"));
    const reject = await authed(request(app).post("/api/admin/users/org1/reject")).send({ reason: "x" });
    expect(approve.status).toBe(403);
    expect(reject.status).toBe(403);
    expect(users.setVerification).not.toHaveBeenCalled();
  });
});

describe("inventory", () => {
  const record = (id, createdAt, phone = "+919876543210") => ({
    _id: id,
    inventoryType: "in",
    bloodGroup: "A+",
    quantity: 450,
    phone,
    createdAt,
  });

  it("applies the day range and phone search", async () => {
    inventory.listRecords.mockResolvedValue({
      records: [
        record("a", "2026-09-20T10:00:00Z"),
        record("b", "2026-09-10T10:00:00Z"),
        record("c", "2026-09-20T11:00:00Z", "+911111111111"),
      ],
      truncated: false,
    });
    const res = await authed(request(app).get("/api/admin/inventory?from=2026-09-15&q=98765"));
    expect(res.body.records.map((r) => r._id)).toEqual(["a"]);
    expect(res.body.total).toBe(1);
  });

  it("filters by unit status, including the virtual 'expired' state", async () => {
    const unit = (id, status, expiresAt) => ({
      _id: id,
      inventoryType: "in",
      bloodGroup: "A+",
      quantity: 100,
      status,
      expiresAt,
      createdAt: "2026-09-20T10:00:00Z",
    });
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    inventory.listRecords.mockResolvedValue({
      records: [
        unit("avail", "available", future),
        unit("stale", "available", past), // still marked available, but past its expiry date
        unit("gone", "discarded", past),
        unit("used", "issued", future),
      ],
      truncated: false,
    });

    const idsFor = async (query) =>
      (await authed(request(app).get(`/api/admin/inventory?${query}`))).body.records.map((r) => r._id);
    expect(await idsFor("status=available")).toEqual(["avail", "stale"]);
    expect(await idsFor("status=expired")).toEqual(["stale"]);
    expect(await idsFor("status=discarded")).toEqual(["gone"]);
    expect(await idsFor("")).toEqual(["avail", "stale", "gone", "used"]);
  });

  it("sorts by soonest expiry when asked, and by newest otherwise", async () => {
    const unit = (id, expiresAt) => ({
      _id: id,
      inventoryType: "in",
      bloodGroup: "A+",
      quantity: 100,
      status: "available",
      expiresAt,
      createdAt: "2026-09-20T10:00:00Z",
    });
    inventory.listRecords.mockResolvedValue({
      records: [
        unit("later", "2026-11-01T00:00:00Z"),
        unit("soonest", "2026-09-25T00:00:00Z"),
        unit("middle", "2026-10-01T00:00:00Z"),
      ],
      truncated: false,
    });
    const res = await authed(request(app).get("/api/admin/inventory?sort=expiry"));
    expect(res.body.records.map((r) => r._id)).toEqual(["soonest", "middle", "later"]);
  });

  it("returns 404 when deleting a record that does not exist", async () => {
    inventory.deleteRecord.mockResolvedValue(null);
    expect((await authed(request(app).delete("/api/admin/inventory/nope"))).status).toBe(404);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("deletes a record and logs it", async () => {
    inventory.deleteRecord.mockResolvedValue({
      ...record("a", "2026-09-20T10:00:00Z"),
      organisation: "org1",
    });
    const res = await authed(request(app).delete("/api/admin/inventory/a"));
    expect(res.status).toBe(200);
    expect(audit.record).toHaveBeenCalledWith(
      admin,
      "inventory.delete",
      { type: "inventory", id: "a", label: "IN 450 ML A+" },
      expect.objectContaining({ organisation: "org1" })
    );
  });
});

describe("requests", () => {
  const bloodRequest = (id, overrides = {}) => ({
    _id: id,
    requester: "h1",
    requesterRole: "hospital",
    requesterPhone: "+919876543210",
    organisation: "org1",
    patientName: "Jane Doe",
    bloodGroup: "A+",
    component: "whole_blood",
    quantity: 450,
    priority: "normal",
    location: "City Hospital",
    status: "pending",
    createdAt: "2026-09-20T10:00:00Z",
    ...overrides,
  });

  it("lists every request across every requester, with filters applied in memory", async () => {
    requestService.listAllRequests.mockResolvedValue({
      requests: [
        bloodRequest("r1"),
        bloodRequest("r2", { requesterRole: "donar", status: "fulfilled", bloodGroup: "O-" }),
      ],
      truncated: false,
    });
    const res = await authed(request(app).get("/api/admin/requests?role=donar"));
    expect(res.status).toBe(200);
    expect(res.body.requests.map((r) => r._id)).toEqual(["r2"]);
    expect(res.body.total).toBe(1);
  });

  it("searches by patient name", async () => {
    requestService.listAllRequests.mockResolvedValue({
      requests: [bloodRequest("r1", { patientName: "Jane Doe" }), bloodRequest("r2", { patientName: "Amit" })],
      truncated: false,
    });
    const res = await authed(request(app).get("/api/admin/requests?q=jane"));
    expect(res.body.requests.map((r) => r._id)).toEqual(["r1"]);
  });

  it("shows every response to one request, with the responder's name filled in", async () => {
    requestService.findRequestById.mockResolvedValue(bloodRequest("r1"));
    responseService.listResponsesForRequest.mockResolvedValue([
      { _id: "resp1", requestId: "r1", responderId: "d1", unitsOffered: 1, status: "confirmed" },
    ]);
    const res = await authed(request(app).get("/api/admin/requests/r1/responses"));
    expect(res.status).toBe(200);
    expect(res.body.responses).toHaveLength(1);
    expect(responseService.listResponsesForRequest).toHaveBeenCalledWith("r1");
  });

  it("answers 404 for responses on a request that does not exist", async () => {
    requestService.findRequestById.mockResolvedValue(null);
    expect((await authed(request(app).get("/api/admin/requests/nope/responses"))).status).toBe(404);
  });
});

describe("admins", () => {
  it("creates an admin from validated input", async () => {
    accounts.createAdminAccount.mockResolvedValue({ _id: "a2", email: "new@example.com" });
    const res = await authed(request(app).post("/api/admin/admins")).send({
      email: "New@Example.com",
      password: "a-long-enough-password",
    });
    expect(res.status).toBe(201);
    expect(accounts.createAdminAccount).toHaveBeenCalledWith(
      { email: "new@example.com", password: "a-long-enough-password", name: "" },
      admin.email
    );
  });

  it("rejects a short password before creating anything", async () => {
    const res = await authed(request(app).post("/api/admin/admins")).send({
      email: "new@example.com",
      password: "short",
    });
    expect(res.status).toBe(400);
    expect(accounts.createAdminAccount).not.toHaveBeenCalled();
  });

  it("does not let an admin remove themselves", async () => {
    accounts.removeAdminAccount.mockRejectedValue(new HttpError(400, "You can not remove your own account"));
    const res = await authed(request(app).delete("/api/admin/admins/admin1"));
    expect(res.status).toBe(400);
    expect(accounts.removeAdminAccount).toHaveBeenCalledWith("admin1", "admin1");
  });
});

describe("dashboard", () => {
  it("serves the cached dashboard, or a fresh one on request", async () => {
    dashboard.getDashboard.mockResolvedValue({ users: { total: 1 } });
    await authed(request(app).get("/api/admin/dashboard"));
    expect(dashboard.clearDashboardCache).not.toHaveBeenCalled();
    const res = await authed(request(app).get("/api/admin/dashboard?fresh=1&n=3"));
    expect(dashboard.clearDashboardCache).toHaveBeenCalledOnce();
    expect(res.body.dashboard).toEqual({ users: { total: 1 } });
  });
});

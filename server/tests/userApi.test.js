import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/tokenService.js", () => ({ verifyIdToken: vi.fn(), phoneNumberOf: vi.fn() }));
vi.mock("../src/services/auditService.js", () => ({
  record: vi.fn(),
  recordActivity: vi.fn(),
  list: vi.fn(),
}));
vi.mock("../src/services/userService.js", async (importOriginal) => ({
  ...(await importOriginal()),
  findUserById: vi.fn(),
  createUser: vi.fn(),
  findUsersByIds: vi.fn(),
}));
vi.mock("../src/services/inventoryService.js", async (importOriginal) => ({
  ...(await importOriginal()),
  recordBlood: vi.fn(),
  discardUnit: vi.fn(),
  findRecords: vi.fn(),
  distinctValues: vi.fn(),
  populate: vi.fn(async (records) => records),
  organisationTotals: vi.fn(),
  organisationOverview: vi.fn(),
}));

const { createApp } = await import("../src/app.js");
const { verifyIdToken, phoneNumberOf } = await import("../src/services/tokenService.js");
const audit = await import("../src/services/auditService.js");
const users = await import("../src/services/userService.js");
const inventory = await import("../src/services/inventoryService.js");
const { HttpError } = await import("../src/utils/HttpError.js");

const app = createApp();
const authed = (req) => req.set("Authorization", "Bearer test-token");

const organisation = {
  _id: "org1",
  role: "organisation",
  organisationName: "City Blood Bank",
  status: "active",
};
const donor = { _id: "donor1", role: "donar", name: "Asha", status: "active" };
const signInAs = (profile) => users.findUserById.mockResolvedValue(profile);

beforeEach(() => {
  vi.clearAllMocks();
  verifyIdToken.mockResolvedValue({ uid: "uid1", phone_number: "+919876543210" });
  inventory.populate.mockImplementation(async (records) => records);
});

describe("platform behaviour", () => {
  it("answers the liveness probe without touching Firebase", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, status: "ok" });
  });

  it("sends the security headers and hides the framework", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("answers unknown routes with a JSON 404", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Route not found" });
  });

  it("rejects a malformed JSON body with a 400", async () => {
    const res = await authed(request(app).post("/api/v1/auth/register"))
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("The request body is not valid JSON");
  });

  it("only allows the configured website origin", async () => {
    const allowed = await request(app).get("/api/v1/nope").set("Origin", "http://localhost:3100");
    const other = await request(app).get("/api/v1/nope").set("Origin", "https://evil.example");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3100");
    expect(other.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("never leaks the details of an unexpected error", async () => {
    signInAs(organisation);
    inventory.findRecords.mockRejectedValue(new Error("secret database detail"));
    const res = await authed(request(app).get("/api/v1/inventory"));
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Something went wrong");
    expect(JSON.stringify(res.body)).not.toContain("secret database detail");
  });

  it("does not offer the OTP-less phone login unless it is enabled", async () => {
    const res = await request(app).post("/api/v1/auth/phone-login").send({ phone: "+919876543210" });
    expect(res.status).toBe(404);
  });
});

describe("authentication", () => {
  it("requires a token", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("passes on an invalid token", async () => {
    verifyIdToken.mockRejectedValue(new HttpError(401, "Your session has expired, please sign in again"));
    const res = await authed(request(app).get("/api/v1/auth/me"));
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/session has expired/);
  });

  it("refuses accounts without a verified phone number (such as admins)", async () => {
    verifyIdToken.mockResolvedValue({ uid: "admin1", email: "a@b.co", admin: true });
    phoneNumberOf.mockResolvedValue(null);
    const res = await authed(request(app).get("/api/v1/auth/me"));
    expect(res.status).toBe(401);
  });

  it("reads the phone number from the account when the token lacks the claim", async () => {
    verifyIdToken.mockResolvedValue({ uid: "uid1" });
    phoneNumberOf.mockResolvedValue("+919876543210");
    users.findUserById.mockResolvedValue(null);
    const res = await authed(request(app).get("/api/v1/auth/me"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, user: null });
  });

  it("registers a profile using the uid and phone from the token, never from the body", async () => {
    users.createUser.mockImplementation(async (uid, phone, profile) => ({ _id: uid, phone, ...profile }));
    const res = await authed(request(app).post("/api/v1/auth/register")).send({
      role: "donar",
      name: "Asha",
      address: "1 Main St",
      city: "Bengaluru",
      phone: "+910000000000",
      userId: "someone-else",
    });
    expect(res.status).toBe(201);
    expect(users.createUser).toHaveBeenCalledWith("uid1", "+919876543210", {
      role: "donar",
      name: "Asha",
      address: "1 Main St",
      city: "Bengaluru",
      website: "",
      registrationNumber: "",
    });
  });

  it("asks a hospital or blood bank for a registration number", async () => {
    const res = await authed(request(app).post("/api/v1/auth/register")).send({
      role: "organisation",
      name: "City Blood Bank",
      address: "1 Main St",
      city: "Bengaluru",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Registration number is required");
    expect(users.createUser).not.toHaveBeenCalled();
  });

  it("registers a blood bank as waiting for approval and logs the sign-up", async () => {
    users.createUser.mockImplementation(async (uid, phone, profile) => ({
      _id: uid,
      phone,
      role: profile.role,
      organisationName: profile.name,
      verification: "pending",
    }));
    const res = await authed(request(app).post("/api/v1/auth/register")).send({
      role: "organisation",
      name: "City Blood Bank",
      address: "1 Main St",
      city: "Bengaluru",
      registrationNumber: "KA/BB/2041",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.verification).toBe("pending");
    expect(users.createUser).toHaveBeenCalledWith(
      "uid1",
      "+919876543210",
      expect.objectContaining({ registrationNumber: "KA/BB/2041" })
    );
    expect(audit.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "uid1", role: "organisation" }),
      "user.register",
      { type: "user", id: "uid1", label: "City Blood Bank" },
      { role: "organisation", verification: "pending" }
    );
  });

  it("does not log a sign-up that was refused", async () => {
    users.createUser.mockResolvedValue(null);
    await authed(request(app).post("/api/v1/auth/register")).send({
      role: "donar",
      name: "Asha",
      address: "1 Main St",
      city: "Bengaluru",
    });
    expect(audit.recordActivity).not.toHaveBeenCalled();
  });

  it("answers 409 when the profile already exists", async () => {
    users.createUser.mockResolvedValue(null);
    const res = await authed(request(app).post("/api/v1/auth/register")).send({
      role: "hospital",
      name: "General",
      address: "2 High St",
      city: "Bengaluru",
      registrationNumber: "H-77",
    });
    expect(res.status).toBe(409);
  });

  it("validates the profile before creating it", async () => {
    const res = await authed(request(app).post("/api/v1/auth/register")).send({ role: "donar", name: "" });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(users.createUser).not.toHaveBeenCalled();
  });
});

describe("role guards", () => {
  it("blocks a donor from organisation endpoints", async () => {
    signInAs(donor);
    const res = await authed(request(app).get("/api/v1/inventory"));
    expect(res.status).toBe(403);
    expect(inventory.findRecords).not.toHaveBeenCalled();
  });

  it("blocks a signed-in phone without a profile", async () => {
    signInAs(null);
    expect((await authed(request(app).get("/api/v1/inventory"))).status).toBe(403);
  });

  it("blocks a suspended user", async () => {
    signInAs({ ...organisation, status: "suspended" });
    const res = await authed(request(app).get("/api/v1/inventory"));
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Your account is suspended");
  });
});

describe("admin approval", () => {
  const hospital = { _id: "h1", role: "hospital", hospitalName: "General", status: "active" };

  it("keeps a blood bank that is waiting for approval out of every organisation endpoint", async () => {
    signInAs({ ...organisation, verification: "pending" });
    for (const path of ["/inventory", "/directory/donors", "/directory/hospitals", "/analytics/stock"]) {
      const res = await authed(request(app).get(`/api/v1${path}`));
      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Your account is waiting for admin approval");
    }
    const write = await authed(request(app).post("/api/v1/inventory")).send({
      phone: "+919876543210",
      inventoryType: "in",
      bloodGroup: "A+",
      quantity: 450,
    });
    expect(write.status).toBe(403);
    expect(inventory.recordBlood).not.toHaveBeenCalled();
    expect(inventory.findRecords).not.toHaveBeenCalled();
  });

  it("tells a rejected blood bank why it can not continue", async () => {
    signInAs({ ...organisation, verification: "rejected" });
    const res = await authed(request(app).get("/api/v1/inventory"));
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Your registration was not approved");
  });

  it("keeps an unapproved hospital out of its screens too", async () => {
    signInAs({ ...hospital, verification: "pending" });
    const res = await authed(request(app).get("/api/v1/inventory/mine"));
    expect(res.status).toBe(403);
    expect(inventory.findRecords).not.toHaveBeenCalled();
  });

  it("lets an approved blood bank work", async () => {
    signInAs({ ...organisation, verification: "approved" });
    inventory.findRecords.mockResolvedValue({ records: [], truncated: false });
    expect((await authed(request(app).get("/api/v1/inventory"))).status).toBe(200);
  });

  it("lets accounts created before approval existed keep working", async () => {
    signInAs(organisation); // no `verification` on the profile
    inventory.findRecords.mockResolvedValue({ records: [], truncated: false });
    expect((await authed(request(app).get("/api/v1/inventory"))).status).toBe(200);
  });

  it("never holds a donor back, and still lets a waiting user read their own profile", async () => {
    signInAs({ ...donor, verification: "approved" });
    inventory.findRecords.mockResolvedValue({ records: [], truncated: false });
    expect((await authed(request(app).get("/api/v1/inventory/mine"))).status).toBe(200);

    users.findUserById.mockResolvedValue({ ...organisation, verification: "pending" });
    const me = await authed(request(app).get("/api/v1/auth/me"));
    expect(me.status).toBe(200);
    expect(me.body.user.verification).toBe("pending");
  });
});

describe("inventory", () => {
  const body = { phone: "+919876543210", inventoryType: "in", bloodGroup: "A+", quantity: 450 };

  it("records blood for the signed-in organisation only", async () => {
    signInAs(organisation);
    inventory.recordBlood.mockResolvedValue({ _id: "r1", ...body });
    const res = await authed(request(app).post("/api/v1/inventory")).send({
      ...body,
      organisation: "evil-org",
    });
    expect(res.status).toBe(201);
    expect(inventory.recordBlood).toHaveBeenCalledWith({ ...body, organisation: "org1" });
  });

  it("logs blood added and blood issued as the blood bank's own activity", async () => {
    signInAs(organisation);
    inventory.recordBlood.mockResolvedValueOnce({ _id: "r1", ...body });
    await authed(request(app).post("/api/v1/inventory")).send(body);
    expect(audit.recordActivity).toHaveBeenLastCalledWith(
      expect.objectContaining({ _id: "org1", role: "organisation" }),
      "inventory.add",
      { type: "inventory", id: "r1", label: "450 ML A+" },
      { bloodGroup: "A+", quantity: 450, phone: "+919876543210" }
    );

    inventory.recordBlood.mockResolvedValueOnce({ _id: "r2", ...body, inventoryType: "out", quantity: 300 });
    await authed(request(app).post("/api/v1/inventory")).send({
      ...body,
      inventoryType: "out",
      quantity: 300,
    });
    expect(audit.recordActivity).toHaveBeenLastCalledWith(
      expect.anything(),
      "inventory.issue",
      { type: "inventory", id: "r2", label: "300 ML A+" },
      expect.objectContaining({ quantity: 300 })
    );
  });

  it("does not log blood that was refused, such as an issue without enough stock", async () => {
    signInAs(organisation);
    inventory.recordBlood.mockRejectedValue(new HttpError(409, "Only 100 ML of A+ is available"));
    await authed(request(app).post("/api/v1/inventory")).send({ ...body, inventoryType: "out" });
    expect(audit.recordActivity).not.toHaveBeenCalled();
  });

  it("rejects an invalid record before it reaches the service", async () => {
    signInAs(organisation);
    const res = await authed(request(app).post("/api/v1/inventory")).send({ ...body, quantity: -5 });
    expect(res.status).toBe(400);
    expect(inventory.recordBlood).not.toHaveBeenCalled();
  });

  it("passes on business errors such as insufficient stock", async () => {
    signInAs(organisation);
    inventory.recordBlood.mockRejectedValue(new HttpError(409, "Only 100 ML of A+ is available"));
    const res = await authed(request(app).post("/api/v1/inventory")).send({ ...body, inventoryType: "out" });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Only 100 ML of A+ is available");
  });

  it("lists an organisation's own records", async () => {
    signInAs(organisation);
    inventory.findRecords.mockResolvedValue({ records: [{ _id: "r1" }], truncated: false });
    const res = await authed(request(app).get("/api/v1/inventory"));
    expect(res.body).toEqual({ success: true, records: [{ _id: "r1" }], truncated: false });
    expect(inventory.findRecords).toHaveBeenCalledWith({ organisation: "org1" });
  });

  describe("discarding a unit", () => {
    it("discards a unit of its own and logs it", async () => {
      signInAs(organisation);
      inventory.discardUnit.mockResolvedValue({
        bloodGroup: "A+",
        quantity: 450,
        discardReason: "damaged",
      });
      const res = await authed(request(app).post("/api/v1/inventory/r1/discard")).send({
        reason: "damaged",
        note: "Bag was leaking",
      });
      expect(res.status).toBe(200);
      expect(inventory.discardUnit).toHaveBeenCalledWith(
        "r1",
        { reason: "damaged", note: "Bag was leaking", organisation: "org1" },
        { label: "City Blood Bank" }
      );
      expect(audit.recordActivity).toHaveBeenCalledWith(
        expect.objectContaining({ _id: "org1" }),
        "inventory.discard",
        { type: "inventory", id: "r1", label: "450 ML A+" },
        { bloodGroup: "A+", quantity: 450, reason: "damaged" }
      );
    });

    it("always scopes the discard to the signed-in blood bank, ignoring any organisation in the body", async () => {
      signInAs(organisation);
      inventory.discardUnit.mockResolvedValue({ bloodGroup: "A+", quantity: 1, discardReason: "other" });
      await authed(request(app).post("/api/v1/inventory/r1/discard")).send({
        reason: "other",
        organisation: "someone-elses-org",
      });
      expect(inventory.discardUnit).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({ organisation: "org1" }),
        expect.anything()
      );
    });

    it("rejects a reason that is not one of the allowed ones, before it reaches the service", async () => {
      signInAs(organisation);
      const res = await authed(request(app).post("/api/v1/inventory/r1/discard")).send({ reason: "because" });
      expect(res.status).toBe(400);
      expect(inventory.discardUnit).not.toHaveBeenCalled();
    });

    it("passes on the service's refusal, such as a unit that was already issued from", async () => {
      signInAs(organisation);
      inventory.discardUnit.mockRejectedValue(
        new HttpError(400, "Part of this unit has already been issued, it can not be discarded whole")
      );
      const res = await authed(request(app).post("/api/v1/inventory/r1/discard")).send({ reason: "damaged" });
      expect(res.status).toBe(400);
      expect(audit.recordActivity).not.toHaveBeenCalled();
    });

    it("is not offered to donors or hospitals", async () => {
      signInAs(donor);
      const res = await authed(request(app).post("/api/v1/inventory/r1/discard")).send({ reason: "damaged" });
      expect(res.status).toBe(403);
      expect(inventory.discardUnit).not.toHaveBeenCalled();
    });
  });

  it("shows a donor only the records that involve them", async () => {
    signInAs(donor);
    inventory.findRecords.mockResolvedValue([]);
    const res = await authed(request(app).get("/api/v1/inventory/mine?type=in&bloodGroup="));
    expect(res.status).toBe(200);
    expect(inventory.findRecords).toHaveBeenCalledWith({
      donar: "donor1",
      inventoryType: "in",
      bloodGroup: undefined,
    });
  });

  it("rejects an unknown record type filter", async () => {
    signInAs(donor);
    expect((await authed(request(app).get("/api/v1/inventory/mine?type=sideways"))).status).toBe(400);
  });
});

describe("directory and analytics", () => {
  it("lists the donors an organisation has dealt with", async () => {
    signInAs(organisation);
    inventory.distinctValues.mockResolvedValue(["donor1"]);
    users.findUsersByIds.mockResolvedValue([donor]);
    const res = await authed(request(app).get("/api/v1/directory/donors"));
    expect(res.body.donors).toEqual([donor]);
    expect(inventory.distinctValues).toHaveBeenCalledWith("donar", { organisation: "org1" });
  });

  it("lets a hospital see its blood banks and nobody else's", async () => {
    signInAs({ _id: "h1", role: "hospital", hospitalName: "General", status: "active" });
    inventory.distinctValues.mockResolvedValue([]);
    users.findUsersByIds.mockResolvedValue([]);
    const res = await authed(request(app).get("/api/v1/directory/organisations"));
    expect(res.status).toBe(200);
    expect(inventory.distinctValues).toHaveBeenCalledWith("organisation", { hospital: "h1" });
    signInAs(organisation);
    expect((await authed(request(app).get("/api/v1/directory/organisations"))).status).toBe(403);
  });

  it("gives a blood bank its stock and newest records in one request, capped by ?recent=", async () => {
    signInAs(organisation);
    const empty = { totalIn: 0, totalOut: 0, totalDiscarded: 0, available: 0, expiringSoonMl: 0 };
    const totals = Object.fromEntries(
      ["O+", "O-", "AB+", "AB-", "A+", "A-", "B+", "B-"].map((g) => [g, empty])
    );
    inventory.organisationOverview.mockResolvedValue({ totals, records: [{ _id: "r1" }], truncated: false });
    const res = await authed(request(app).get("/api/v1/analytics/overview?recent=3"));
    expect(res.status).toBe(200);
    expect(res.body.stock).toHaveLength(8);
    expect(res.body.records).toEqual([{ _id: "r1" }]);
    expect(inventory.organisationOverview).toHaveBeenCalledWith("org1", 3);

    await authed(request(app).get("/api/v1/analytics/overview"));
    expect(inventory.organisationOverview).toHaveBeenLastCalledWith("org1", 5);
    expect((await authed(request(app).get("/api/v1/analytics/overview?recent=500"))).status).toBe(400);

    signInAs(donor);
    expect((await authed(request(app).get("/api/v1/analytics/overview"))).status).toBe(403);
  });

  it("reports stock for every blood group with the available amount", async () => {
    signInAs(organisation);
    const empty = { totalIn: 0, totalOut: 0, totalDiscarded: 0, available: 0, expiringSoonMl: 0 };
    const totals = Object.fromEntries(
      ["O+", "O-", "AB+", "AB-", "A+", "A-", "B+", "B-"].map((g) => [g, empty])
    );
    totals["A+"] = { totalIn: 800, totalOut: 300, totalDiscarded: 50, available: 450, expiringSoonMl: 100 };
    inventory.organisationTotals.mockResolvedValue({ totals, truncated: false });
    const res = await authed(request(app).get("/api/v1/analytics/stock"));
    expect(res.body.stock).toHaveLength(8);
    // the controller no longer recomputes `available` itself, so a wrong service figure would show through
    expect(res.body.stock.find((s) => s.bloodGroup === "A+")).toEqual({
      bloodGroup: "A+",
      totalIn: 800,
      totalOut: 300,
      totalDiscarded: 50,
      available: 450,
      expiringSoonMl: 100,
    });
  });
});

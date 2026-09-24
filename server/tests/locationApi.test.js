import { beforeEach, describe, expect, it, vi } from "vitest";

// Same setup as services.test.js: the real services run against an in-memory Firestore.
vi.mock("firebase-admin/firestore", async () => {
  const { FieldValue } = await import("./helpers/fakeFirestore.js");
  return { FieldValue };
});
vi.mock("../src/config/firebase.js", async () => {
  const { db } = await import("./helpers/fakeFirestore.js");
  return { getDb: () => db, getAdminAuth: () => ({}) };
});

const { db } = await import("./helpers/fakeFirestore.js");
const location = await import("../src/services/locationService.js");
const camps = await import("../src/services/campService.js");
const users = await import("../src/services/userService.js");
const { HttpError } = await import("../src/utils/HttpError.js");

const DONOR = { _id: "donor1", role: "donar", name: "Asha", phone: "+919876543210", status: "active" };
const HOSPITAL = {
  _id: "hosp1",
  role: "hospital",
  hospitalName: "General",
  phone: "+912000000001",
  status: "active",
};
const ORG = {
  _id: "org1",
  role: "organisation",
  organisationName: "City Blood Bank",
  phone: "+911000000001",
  status: "active",
};

const seedPeople = () =>
  db.seed("users", {
    donor1: { ...DONOR, verification: "approved" },
    hosp1: { ...HOSPITAL, verification: "approved" },
    org1: { ...ORG, verification: "approved" },
    // A suspended blood bank should never show up on anyone's map, even if it once shared its location.
    orgSuspended: {
      role: "organisation",
      organisationName: "Closed Bank",
      phone: "+911000000002",
      status: "suspended",
      verification: "approved",
      locationSharing: true,
      location: { lat: 1, lng: 1, accuracy: null, updatedAt: "2024-01-01T00:00:00.000Z" },
    },
  });

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

describe("sharing a location", () => {
  it("records lat/lng/accuracy and turns sharing on", async () => {
    seedPeople();
    const location1 = await location.updateLocation(DONOR, { lat: 12.9, lng: 77.6, accuracy: 15 });
    expect(location1).toMatchObject({ lat: 12.9, lng: 77.6, accuracy: 15 });
    expect(location1.updatedAt).toEqual(expect.any(String));

    const stored = db.read("users", "donor1");
    expect(stored.locationSharing).toBe(true);
    expect(stored.location).toMatchObject({ lat: 12.9, lng: 77.6 });
  });

  it("deletes the stored location when sharing is turned off", async () => {
    seedPeople();
    await location.updateLocation(HOSPITAL, { lat: 12.9, lng: 77.6 });
    expect(db.read("users", "hosp1").location).toBeTruthy();

    await location.setSharing(HOSPITAL, false);
    const stored = db.read("users", "hosp1");
    expect(stored.locationSharing).toBe(false);
    expect(stored).not.toHaveProperty("location");
  });
});

describe("who can see whose location", () => {
  it("never includes a donor in the public nearby list, even when the donor is sharing", async () => {
    seedPeople();
    await location.updateLocation(DONOR, { lat: 1, lng: 1 });
    await location.updateLocation(HOSPITAL, { lat: 2, lng: 2 });
    await location.updateLocation(ORG, { lat: 3, lng: 3 });

    const nearby = await location.listNearbyPeople();
    expect(nearby.map((p) => p.role).sort()).toEqual(["hospital", "organisation"]);
  });

  it("excludes a suspended blood bank from the nearby list", async () => {
    seedPeople();
    const nearby = await location.listNearbyPeople();
    expect(nearby.find((p) => p._id === "orgSuspended")).toBeUndefined();
  });

  it("shows a donor's location to the admin view only", async () => {
    seedPeople();
    await location.updateLocation(DONOR, { lat: 1, lng: 1 });

    const forAdmin = await location.listForAdmin();
    const donor = forAdmin.find((p) => p._id === "donor1");
    expect(donor).toMatchObject({ role: "donar", location: { lat: 1, lng: 1 } });
  });

  it("never leaks a donor's location through the generic 'view another user's profile' path", async () => {
    // e.g. an organisation looking up the donors it has recorded blood from (GET /directory/donors),
    // or a blood record populated with the donor's profile — neither is locationService, so a donor's
    // location must not ride along on either of them.
    seedPeople();
    await location.updateLocation(DONOR, { lat: 1, lng: 1 });

    const [profile] = await users.findUsersByIds(["donor1"]);
    expect(profile).not.toHaveProperty("location");
    expect(profile).not.toHaveProperty("locationSharing");
  });
});

describe("blood camps", () => {
  const body = {
    name: "City Park Camp",
    address: "City Park, Main Road",
    description: "",
    location: { lat: 10, lng: 20 },
    startDate: "2026-01-01",
    endDate: "2026-01-02",
  };

  it("lets an organisation create, edit and delete its own camp", async () => {
    const camp = await camps.createCamp(ORG, body);
    expect(camp).toMatchObject({ organisation: "org1", status: "active", ...body });

    const updated = await camps.updateCamp(camp._id, "org1", { ...body, name: "Renamed Camp" });
    expect(updated.name).toBe("Renamed Camp");

    const removed = await camps.removeCamp(camp._id, "org1");
    expect(removed._id).toBe(camp._id);
    expect(db.read("camps", camp._id)).toBeUndefined();
  });

  it("refuses to let one organisation edit another's camp", async () => {
    const camp = await camps.createCamp(ORG, body);
    const error = await rejection(camps.updateCamp(camp._id, "someone-else", body));
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(404);
  });

  it("only lists active camps for the public map, but admins see suspended ones too", async () => {
    const active = await camps.createCamp(ORG, body);
    const toSuspend = await camps.createCamp(ORG, { ...body, name: "Second Camp" });
    await camps.setCampStatus(toSuspend._id, "suspended");

    const publicList = await camps.listActiveCamps();
    expect(publicList.map((c) => c._id)).toEqual([active._id]);

    const adminList = await camps.listAllCamps();
    expect(adminList.map((c) => c._id).sort()).toEqual([active._id, toSuspend._id].sort());
  });
});

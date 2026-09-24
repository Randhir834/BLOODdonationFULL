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
  listApprovedOrganisations: vi.fn(),
}));
vi.mock("../src/services/requestService.js", () => ({
  createRequest: vi.fn(),
  editRequest: vi.fn(),
  findRequestById: vi.fn(),
  listRequests: vi.fn(),
  listNearbyRequests: vi.fn(),
  fulfilRequest: vi.fn(),
  rejectRequest: vi.fn(),
  cancelRequest: vi.fn(),
}));
vi.mock("../src/services/inventoryService.js", async (importOriginal) => ({
  ...(await importOriginal()),
  populate: vi.fn(async (records) => records),
}));
vi.mock("../src/services/notificationService.js", () => ({ notifyEligibleUsers: vi.fn() }));
vi.mock("../src/services/responseService.js", () => ({
  createResponse: vi.fn(),
  findResponseById: vi.fn(),
  listResponsesForRequest: vi.fn(),
  confirmResponse: vi.fn(),
  declineResponse: vi.fn(),
  withdrawResponse: vi.fn(),
  handleCancelledRequest: vi.fn(),
  findOwnResponse: vi.fn(),
}));

const { createApp } = await import("../src/app.js");
const { verifyIdToken } = await import("../src/services/tokenService.js");
const audit = await import("../src/services/auditService.js");
const users = await import("../src/services/userService.js");
const requests = await import("../src/services/requestService.js");
const inventory = await import("../src/services/inventoryService.js");
const responses = await import("../src/services/responseService.js");
const { HttpError } = await import("../src/utils/HttpError.js");

const app = createApp();
const authed = (req) => req.set("Authorization", "Bearer test-token");

const donor = { _id: "d1", role: "donar", name: "Asha", status: "active" };
const hospital = { _id: "h1", role: "hospital", hospitalName: "General", status: "active" };
const organisation = {
  _id: "org1",
  role: "organisation",
  organisationName: "City Blood Bank",
  status: "active",
};
const signInAs = (profile) => users.findUserById.mockResolvedValue(profile);

const pendingRequest = {
  _id: "r1",
  requester: "h1",
  requesterRole: "hospital",
  requesterPhone: "+919876543210",
  organisation: "org1",
  city: "Bengaluru",
  cityKey: "bengaluru",
  patientName: "Jane Doe",
  bloodGroup: "A+",
  component: "whole_blood",
  quantity: 450,
  priority: "normal",
  location: "City Hospital",
  status: "pending",
};

const body = {
  organisation: "org1",
  patientName: "Jane Doe",
  bloodGroup: "A+",
  quantity: 450,
  location: "City Hospital",
};

beforeEach(() => {
  vi.clearAllMocks();
  verifyIdToken.mockResolvedValue({ uid: "uid1", phone_number: "+919876543210" });
  inventory.populate.mockImplementation(async (records) => records);
});

describe("creating a request", () => {
  it.each([
    ["a donor", donor],
    ["a hospital", hospital],
    ["a blood bank", organisation],
  ])("lets %s ask a blood bank for blood, and logs it", async (_name, actor) => {
    signInAs(actor);
    requests.createRequest.mockResolvedValue(pendingRequest);
    const res = await authed(request(app).post("/api/v1/requests")).send(body);
    expect(res.status).toBe(201);
    expect(requests.createRequest).toHaveBeenCalledWith(actor, {
      ...body,
      component: "whole_blood",
      priority: "normal",
      contactName: "",
      contactPhone: "",
      note: "",
    });
    expect(audit.recordActivity).toHaveBeenCalledWith(
      actor,
      "request.create",
      { type: "request", id: "r1", label: "450 ML A+" },
      { organisation: "org1", city: "Bengaluru", priority: "normal" }
    );
  });

  it("rejects an invalid request before it reaches the service", async () => {
    signInAs(hospital);
    const res = await authed(request(app).post("/api/v1/requests")).send({ ...body, quantity: -1 });
    expect(res.status).toBe(400);
    expect(requests.createRequest).not.toHaveBeenCalled();
  });

  it("passes on a business refusal, such as an unapproved blood bank", async () => {
    signInAs(hospital);
    requests.createRequest.mockRejectedValue(new HttpError(409, "This blood bank has not been approved yet"));
    const res = await authed(request(app).post("/api/v1/requests")).send(body);
    expect(res.status).toBe(409);
    expect(audit.recordActivity).not.toHaveBeenCalled();
  });
});

describe("editing a request", () => {
  const updateBody = { bloodGroup: "A+", component: "whole_blood", priority: "normal" };

  it("lets the requester edit their own pending request, and logs it", async () => {
    signInAs(hospital);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    requests.editRequest.mockResolvedValue({ ...pendingRequest, patientName: "John Smith" });
    const res = await authed(request(app).patch("/api/v1/requests/r1")).send({
      ...updateBody,
      patientName: "John Smith",
    });
    expect(res.status).toBe(200);
    expect(res.body.request.patientName).toBe("John Smith");
    expect(audit.recordActivity).toHaveBeenCalledWith(
      hospital,
      "request.update",
      { type: "request", id: "r1", label: "450 ML A+" }
    );
  });

  it("lets a field be left out, to keep its current value", async () => {
    signInAs(hospital);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    requests.editRequest.mockResolvedValue(pendingRequest);
    const res = await authed(request(app).patch("/api/v1/requests/r1")).send(updateBody);
    expect(res.status).toBe(200);
    expect(requests.editRequest).toHaveBeenCalledWith(
      pendingRequest,
      hospital,
      expect.objectContaining(updateBody)
    );
  });
});

describe("listing requests", () => {
  it("shows a blood bank the requests naming it, with the requester's name", async () => {
    signInAs(organisation);
    requests.listRequests.mockResolvedValue([pendingRequest]);
    const res = await authed(request(app).get("/api/v1/requests?status=pending"));
    expect(res.status).toBe(200);
    expect(res.body.requests).toEqual([pendingRequest]);
    expect(requests.listRequests).toHaveBeenCalledWith("organisation", "org1", "pending");
    // the requester's name is filled in, so a blood bank never sees just a bare id
    expect(inventory.populate).toHaveBeenCalledWith([pendingRequest], ["requester"]);
  });

  it("shows any signed-in user its own requests, and no one else's, with the blood bank's name", async () => {
    signInAs(hospital);
    requests.listRequests.mockResolvedValue([pendingRequest]);
    const res = await authed(request(app).get("/api/v1/requests/mine"));
    expect(res.status).toBe(200);
    expect(requests.listRequests).toHaveBeenCalledWith("requester", "h1", undefined);
    // the blood bank's name is filled in, so a requester never sees just a bare id
    expect(inventory.populate).toHaveBeenCalledWith([pendingRequest], ["organisation"]);

    signInAs(organisation);
    expect((await authed(request(app).get("/api/v1/requests/mine"))).status).toBe(200);
  });

  it("rejects an unknown status filter", async () => {
    signInAs(organisation);
    expect((await authed(request(app).get("/api/v1/requests?status=whenever"))).status).toBe(400);
  });
});

describe("browsing nearby requests", () => {
  it("shows other people's pending requests from the signed-in user's own city", async () => {
    signInAs({ ...donor, cityKey: "bengaluru" });
    requests.listNearbyRequests.mockResolvedValue([pendingRequest]);
    const res = await authed(request(app).get("/api/v1/requests/nearby?status=pending"));
    expect(res.status).toBe(200);
    expect(res.body.requests).toEqual([pendingRequest]);
    expect(requests.listNearbyRequests).toHaveBeenCalledWith("bengaluru", "d1", "pending");
    expect(inventory.populate).toHaveBeenCalledWith([pendingRequest], ["requester", "organisation"]);
  });
});

describe("viewing one request", () => {
  it("lets any signed-in user view a request by id, e.g. opened from a notification, with their own response", async () => {
    signInAs(donor);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    responses.findOwnResponse.mockResolvedValue({ _id: "resp1", status: "pending", unitsOffered: 1 });
    const res = await authed(request(app).get("/api/v1/requests/r1"));
    expect(res.status).toBe(200);
    expect(res.body.request).toEqual(pendingRequest);
    expect(res.body.myResponse).toMatchObject({ status: "pending" });
    expect(inventory.populate).toHaveBeenCalledWith([pendingRequest], ["requester", "organisation"]);
    expect(responses.findOwnResponse).toHaveBeenCalledWith("r1", "d1");
  });

  it("answers 404 for a request that does not exist", async () => {
    signInAs(donor);
    requests.findRequestById.mockResolvedValue(null);
    expect((await authed(request(app).get("/api/v1/requests/nope"))).status).toBe(404);
  });
});

describe("responding to a request", () => {
  it("fulfils a request and logs it", async () => {
    signInAs(organisation);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    requests.fulfilRequest.mockResolvedValue({
      ...pendingRequest,
      status: "fulfilled",
      fulfilledRecordId: "rec1",
    });
    const res = await authed(request(app).post("/api/v1/requests/r1/fulfil"));
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe("fulfilled");
    expect(requests.fulfilRequest).toHaveBeenCalledWith(pendingRequest, "org1");
    expect(audit.recordActivity).toHaveBeenCalledWith(
      organisation,
      "request.fulfil",
      { type: "request", id: "r1", label: "450 ML A+" },
      { fulfilledRecordId: "rec1" }
    );
  });

  it("answers 404 for a request that does not exist", async () => {
    signInAs(organisation);
    requests.findRequestById.mockResolvedValue(null);
    expect((await authed(request(app).post("/api/v1/requests/nope/fulfil"))).status).toBe(404);
    expect(requests.fulfilRequest).not.toHaveBeenCalled();
  });

  it("passes on insufficient stock without logging anything", async () => {
    signInAs(organisation);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    requests.fulfilRequest.mockRejectedValue(new HttpError(409, "Only 100 ML of A+ is available"));
    const res = await authed(request(app).post("/api/v1/requests/r1/fulfil"));
    expect(res.status).toBe(409);
    expect(audit.recordActivity).not.toHaveBeenCalled();
  });

  it("needs a reason to reject, then logs it", async () => {
    signInAs(organisation);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    const missing = await authed(request(app).post("/api/v1/requests/r1/reject")).send({ reason: "  " });
    expect(missing.status).toBe(400);
    expect(requests.rejectRequest).not.toHaveBeenCalled();

    requests.rejectRequest.mockResolvedValue({
      ...pendingRequest,
      status: "rejected",
      rejectionReason: "No stock",
    });
    const res = await authed(request(app).post("/api/v1/requests/r1/reject")).send({ reason: "No stock" });
    expect(res.status).toBe(200);
    expect(requests.rejectRequest).toHaveBeenCalledWith(pendingRequest, "org1", "No stock");
    expect(audit.recordActivity).toHaveBeenCalledWith(
      organisation,
      "request.reject",
      { type: "request", id: "r1", label: "450 ML A+" },
      { reason: "No stock" }
    );
  });

  it("lets the requester cancel its own request", async () => {
    signInAs(hospital);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    requests.cancelRequest.mockResolvedValue({ ...pendingRequest, status: "cancelled" });
    const res = await authed(request(app).post("/api/v1/requests/r1/cancel"));
    expect(res.status).toBe(200);
    expect(requests.cancelRequest).toHaveBeenCalledWith(pendingRequest, "h1");
    expect(responses.handleCancelledRequest).toHaveBeenCalledWith({
      ...pendingRequest,
      status: "cancelled",
    });
  });

  it("does not let a hospital or donor fulfil or reject a request", async () => {
    signInAs(hospital);
    expect((await authed(request(app).post("/api/v1/requests/r1/fulfil"))).status).toBe(403);
    expect((await authed(request(app).post("/api/v1/requests/r1/reject")).send({ reason: "x" })).status).toBe(
      403
    );
    signInAs(donor);
    expect((await authed(request(app).post("/api/v1/requests/r1/fulfil"))).status).toBe(403);
  });
});

describe("responding to someone else's request", () => {
  const pendingResponse = {
    _id: "resp1",
    requestId: "r1",
    responderId: "d1",
    responderRole: "donar",
    unitsOffered: 1,
    status: "pending",
  };

  it("lets a donor offer units, and logs it", async () => {
    signInAs(donor);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    responses.createResponse.mockResolvedValue(pendingResponse);
    const res = await authed(request(app).post("/api/v1/requests/r1/respond")).send({ unitsOffered: 1 });
    expect(res.status).toBe(201);
    expect(responses.createResponse).toHaveBeenCalledWith(pendingRequest, donor, 1);
    expect(audit.recordActivity).toHaveBeenCalledWith(
      donor,
      "response.create",
      { type: "response", id: "resp1", label: "1 unit(s)" },
      { requestId: "r1" }
    );
  });

  it("defaults to offering 1 unit", async () => {
    signInAs(donor);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    responses.createResponse.mockResolvedValue(pendingResponse);
    await authed(request(app).post("/api/v1/requests/r1/respond")).send({});
    expect(responses.createResponse).toHaveBeenCalledWith(pendingRequest, donor, 1);
  });

  it("shows the requester every response, with the responder's name filled in", async () => {
    signInAs(hospital);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    responses.listResponsesForRequest.mockResolvedValue([pendingResponse]);
    const res = await authed(request(app).get("/api/v1/requests/r1/responses"));
    expect(res.status).toBe(200);
    expect(res.body.responses).toEqual([pendingResponse]);
    expect(inventory.populate).toHaveBeenCalledWith([pendingResponse], ["responderId"]);
  });

  it("refuses to show responses on a request that is not yours", async () => {
    signInAs(donor);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    expect((await authed(request(app).get("/api/v1/requests/r1/responses"))).status).toBe(404);
  });

  it("lets the requester confirm a response", async () => {
    signInAs(hospital);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    responses.findResponseById.mockResolvedValue(pendingResponse);
    const confirmed = { ...pendingResponse, status: "confirmed", unitsApplied: 1 };
    responses.confirmResponse.mockResolvedValue({
      request: { ...pendingRequest, unitsConfirmed: 1 },
      response: confirmed,
      fulfilled: false,
    });
    const res = await authed(request(app).post("/api/v1/requests/r1/responses/resp1/confirm"));
    expect(res.status).toBe(200);
    expect(responses.confirmResponse).toHaveBeenCalledWith(pendingRequest, pendingResponse, "h1");
    expect(res.body.response.status).toBe("confirmed");
  });

  it("lets the requester decline a response", async () => {
    signInAs(hospital);
    requests.findRequestById.mockResolvedValue(pendingRequest);
    responses.findResponseById.mockResolvedValue(pendingResponse);
    responses.declineResponse.mockResolvedValue({ ...pendingResponse, status: "declined" });
    const res = await authed(request(app).post("/api/v1/requests/r1/responses/resp1/decline"));
    expect(res.status).toBe(200);
    expect(responses.declineResponse).toHaveBeenCalledWith(pendingRequest, pendingResponse, "h1");
  });

  it("lets a responder withdraw their own offer", async () => {
    signInAs(donor);
    responses.findResponseById.mockResolvedValue(pendingResponse);
    responses.withdrawResponse.mockResolvedValue({ ...pendingResponse, status: "withdrawn" });
    const res = await authed(request(app).post("/api/v1/requests/r1/responses/resp1/withdraw"));
    expect(res.status).toBe(200);
    expect(responses.withdrawResponse).toHaveBeenCalledWith(pendingResponse, "d1");
  });

  it("answers 404 for a response that does not exist", async () => {
    signInAs(donor);
    responses.findResponseById.mockResolvedValue(null);
    expect((await authed(request(app).post("/api/v1/requests/r1/responses/nope/withdraw"))).status).toBe(404);
  });
});

describe("discovering blood banks to request from", () => {
  it.each([
    ["a donor", donor],
    ["a hospital", hospital],
  ])("lists every active, approved blood bank for %s", async (_name, actor) => {
    signInAs(actor);
    users.listApprovedOrganisations.mockResolvedValue([organisation]);
    const res = await authed(request(app).get("/api/v1/directory/blood-banks"));
    expect(res.status).toBe(200);
    expect(res.body.organisations).toEqual([organisation]);
  });

  it("never lists a blood bank itself", async () => {
    signInAs(organisation);
    users.listApprovedOrganisations.mockResolvedValue([organisation, { _id: "org2", role: "organisation" }]);
    const res = await authed(request(app).get("/api/v1/directory/blood-banks"));
    expect(res.status).toBe(200);
    expect(res.body.organisations).toEqual([{ _id: "org2", role: "organisation" }]);
  });
});

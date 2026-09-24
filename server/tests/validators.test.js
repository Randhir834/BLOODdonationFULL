import { describe, expect, it } from "vitest";
import { HttpError } from "../src/utils/HttpError.js";
import {
  createAdminBody,
  listInventoryQuery,
  listUsersQuery,
  rejectUserBody,
  suspendUserBody,
} from "../src/validators/admin.validator.js";
import { registerBody, updateProfileBody } from "../src/validators/auth.validator.js";
import { idParams } from "../src/validators/common.js";
import { createRecordBody, discardUnitBody } from "../src/validators/inventory.validator.js";
import { parse } from "../src/validators/parse.js";
import {
  createRequestBody,
  listRequestsQuery,
  rejectRequestBody,
  respondToRequestBody,
  updateRequestBody,
} from "../src/validators/request.validator.js";

const failure = (schema, data) => {
  try {
    parse(schema, data);
  } catch (error) {
    return error;
  }
  throw new Error("expected the data to be rejected");
};

describe("parse", () => {
  it("throws a 400 HttpError carrying every problem", () => {
    const error = failure(createRecordBody, {});
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(400);
    expect(error.details.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(["phone", "inventoryType", "bloodGroup", "quantity"])
    );
  });

  it("treats a missing body as an empty object", () => {
    expect(failure(registerBody, undefined).status).toBe(400);
  });
});

describe("createRecordBody", () => {
  const valid = { phone: "+919876543210", inventoryType: "in", bloodGroup: "A+", quantity: 450 };

  it("accepts a valid record and drops unknown fields", () => {
    expect(parse(createRecordBody, { ...valid, organisation: "someone-else" })).toEqual(valid);
  });

  it.each([
    ["a phone without a country code", { phone: "9876543210" }, "Enter the phone number"],
    ["an unknown blood group", { bloodGroup: "Z+" }, "Choose a blood group"],
    ["an unknown type", { inventoryType: "sideways" }, "Choose whether"],
    ["a quantity given as text", { quantity: "450" }, "Enter the amount"],
    ["a zero quantity", { quantity: 0 }, "Enter the amount"],
    ["a fractional quantity", { quantity: 1.5 }, "whole number"],
    ["a huge quantity", { quantity: 1e9 }, "most you can record"],
  ])("rejects %s", (_name, patch, message) => {
    expect(failure(createRecordBody, { ...valid, ...patch }).message).toContain(message);
  });
});

describe("discardUnitBody", () => {
  it("accepts every allowed reason, note optional", () => {
    expect(parse(discardUnitBody, { reason: "expired" })).toEqual({ reason: "expired", note: "" });
    expect(parse(discardUnitBody, { reason: "other", note: " Looked odd " })).toEqual({
      reason: "other",
      note: "Looked odd",
    });
  });

  it("rejects a reason that is not on the list", () => {
    expect(failure(discardUnitBody, { reason: "because" }).message).toBe("Choose a reason");
    expect(failure(discardUnitBody, {}).message).toBe("Choose a reason");
  });
});

describe("createRequestBody", () => {
  const valid = {
    organisation: "org1",
    patientName: "Jane Doe",
    bloodGroup: "A+",
    quantity: 450,
    location: "City Hospital, Ward 4",
  };

  it("accepts a valid request and defaults priority, component, note and contact fields", () => {
    expect(parse(createRequestBody, valid)).toEqual({
      ...valid,
      priority: "normal",
      component: "whole_blood",
      contactName: "",
      contactPhone: "",
      note: "",
    });
  });

  it("accepts every priority and trims the note", () => {
    expect(parse(createRequestBody, { ...valid, priority: "emergency", note: " ICU " }).priority).toBe(
      "emergency"
    );
    expect(parse(createRequestBody, { ...valid, note: " ICU " }).note).toBe("ICU");
  });

  it("accepts an optional required date/time", () => {
    expect(parse(createRequestBody, { ...valid, requiredAt: "2026-10-01T14:30" }).requiredAt).toBe(
      "2026-10-01T14:30"
    );
    expect(parse(createRequestBody, valid).requiredAt).toBeUndefined();
  });

  it("accepts a request with no blood bank named (the city-broadcast default)", () => {
    const { organisation: _omit, ...withoutBank } = valid;
    expect(parse(createRequestBody, withoutBank).organisation).toBeUndefined();
  });

  it.each([
    ["a bad blood bank id", { organisation: "a/b" }, "Invalid id"],
    ["a missing patient name", { patientName: "" }, "Enter the patient's name"],
    ["an unknown blood group", { bloodGroup: "Z+" }, "Choose a blood group"],
    ["an unknown component", { component: "sideways" }, "Choose a component"],
    ["a fractional quantity", { quantity: 1.5 }, "whole number"],
    ["a zero quantity", { quantity: 0 }, "Enter the amount"],
    ["an unknown priority", { priority: "asap" }, "Choose a priority"],
    ["a missing location", { location: "" }, "Enter the hospital or location"],
    ["an invalid required date/time", { requiredAt: "not-a-date" }, "valid date and time"],
  ])("rejects %s", (_name, patch, message) => {
    expect(failure(createRequestBody, { ...valid, ...patch }).message).toContain(message);
  });
});

describe("updateRequestBody", () => {
  const valid = { bloodGroup: "A+", component: "whole_blood", priority: "normal" };

  it("accepts the choice fields alone, leaving every free-text and quantity field out", () => {
    expect(parse(updateRequestBody, valid)).toEqual(valid);
  });

  it("accepts any of the optional fields alongside the required choices", () => {
    expect(parse(updateRequestBody, { ...valid, patientName: "Jane Doe", quantity: 300 })).toEqual({
      ...valid,
      patientName: "Jane Doe",
      quantity: 300,
    });
  });

  it.each(["bloodGroup", "component", "priority"])(
    "requires %s, since it always arrives as a real choice",
    (field) => {
      const { [field]: _omit, ...withoutOne } = valid;
      expect(failure(updateRequestBody, withoutOne).details.errors.map((e) => e.field)).toContain(field);
    }
  );
});

describe("rejectRequestBody and listRequestsQuery", () => {
  it("requires a reason to reject a request", () => {
    expect(failure(rejectRequestBody, { reason: "  " }).message).toBe("Please give a reason");
    expect(parse(rejectRequestBody, { reason: " No stock " })).toEqual({ reason: "No stock" });
  });

  it("filters requests by status and rejects an unknown one", () => {
    expect(parse(listRequestsQuery, { status: "fulfilled" }).status).toBe("fulfilled");
    expect(parse(listRequestsQuery, {}).status).toBeUndefined();
    expect(failure(listRequestsQuery, { status: "maybe" }).status).toBe(400);
  });
});

describe("registerBody", () => {
  it("trims text and defaults the website", () => {
    expect(
      parse(registerBody, { role: "donar", name: "  Asha  ", address: " 1 Main St ", city: " Bengaluru " })
    ).toEqual({
      role: "donar",
      name: "Asha",
      address: "1 Main St",
      city: "Bengaluru",
      website: "",
      registrationNumber: "",
    });
  });

  it("requires a name, address and city", () => {
    expect(failure(registerBody, { role: "donar", name: "  ", address: "x", city: "x" }).message).toBe(
      "Name is required"
    );
    expect(
      failure(registerBody, { role: "hospital", name: "x", address: "", city: "x", registrationNumber: "R1" })
        .message
    ).toBe("Address is required");
    expect(
      failure(registerBody, { role: "donar", name: "x", address: "x", city: "  " }).message
    ).toBe("City is required");
  });

  it.each(["hospital", "organisation"])("requires a registration number from a %s", (role) => {
    const body = { role, name: "x", address: "x", city: "x" };
    const error = failure(registerBody, body);
    expect(error.message).toBe("Registration number is required");
    expect(error.details.errors[0].field).toBe("registrationNumber");
    expect(failure(registerBody, { ...body, registrationNumber: "   " }).status).toBe(400);
    expect(parse(registerBody, { ...body, registrationNumber: " KA/BB/2041 " }).registrationNumber).toBe(
      "KA/BB/2041"
    );
  });

  it("does not ask a donor for a registration number", () => {
    expect(parse(registerBody, { role: "donar", name: "Asha", address: "x", city: "x" }).registrationNumber).toBe(
      ""
    );
  });

  it("limits the length of the registration number", () => {
    const body = {
      role: "organisation",
      name: "x",
      address: "x",
      city: "x",
      registrationNumber: "9".repeat(61),
    };
    expect(failure(registerBody, body).message).toBe("Registration number is too long");
  });

  it("rejects an unknown role", () => {
    expect(failure(registerBody, { role: "admin", name: "x", address: "x", city: "x" }).status).toBe(400);
  });
});

describe("updateProfileBody", () => {
  it("trims address and city", () => {
    expect(parse(updateProfileBody, { address: " 1 Main St ", city: " Bengaluru " })).toEqual({
      address: "1 Main St",
      city: "Bengaluru",
    });
  });

  it("requires both fields", () => {
    expect(failure(updateProfileBody, { address: "", city: "x" }).message).toBe("Address is required");
    expect(failure(updateProfileBody, { address: "x", city: "  " }).message).toBe("City is required");
  });
});

describe("admin schemas", () => {
  it("treats empty query values as unset and applies paging defaults", () => {
    expect(parse(listUsersQuery, { role: "", status: "", q: "", page: "", pageSize: "" })).toEqual({
      page: 1,
      pageSize: 25,
    });
  });

  it("coerces and bounds paging", () => {
    expect(parse(listUsersQuery, { page: "3", pageSize: "50" })).toMatchObject({ page: 3, pageSize: 50 });
    expect(failure(listUsersQuery, { pageSize: "500" }).status).toBe(400);
    expect(failure(listUsersQuery, { page: "0" }).status).toBe(400);
  });

  it("validates inventory filters", () => {
    expect(parse(listInventoryQuery, { bloodGroup: "AB-", from: "2026-01-31" })).toMatchObject({
      bloodGroup: "AB-",
      from: "2026-01-31",
    });
    expect(failure(listInventoryQuery, { from: "31/01/2026" }).status).toBe(400);
  });

  it("accepts a unit status, including the virtual 'expired' one, and defaults the sort", () => {
    expect(parse(listInventoryQuery, { status: "available" }).status).toBe("available");
    expect(parse(listInventoryQuery, { status: "expired" }).status).toBe("expired");
    expect(parse(listInventoryQuery, {}).sort).toBe("newest");
    expect(parse(listInventoryQuery, { sort: "expiry" }).sort).toBe("expiry");
    expect(failure(listInventoryQuery, { status: "rotten" }).status).toBe(400);
    expect(failure(listInventoryQuery, { sort: "size" }).status).toBe(400);
  });

  it("requires a reason to suspend", () => {
    expect(failure(suspendUserBody, { reason: "   " }).message).toBe("Please give a reason");
  });

  it("requires a reason to reject a registration", () => {
    expect(failure(rejectUserBody, { reason: "   " }).message).toBe("Please give a reason");
    expect(parse(rejectUserBody, { reason: " Licence expired " })).toEqual({ reason: "Licence expired" });
  });

  it("filters the user list by approval state and rejects unknown states", () => {
    expect(parse(listUsersQuery, { verification: "pending" }).verification).toBe("pending");
    expect(parse(listUsersQuery, { verification: "" }).verification).toBeUndefined();
    expect(failure(listUsersQuery, { verification: "maybe" }).status).toBe(400);
  });

  it("normalises the email and enforces the password length", () => {
    expect(
      parse(createAdminBody, { email: " Admin@Example.COM ", password: "a-long-enough-password" })
    ).toEqual({
      email: "admin@example.com",
      password: "a-long-enough-password",
      name: "",
    });
    expect(failure(createAdminBody, { email: "nope", password: "a-long-enough-password" }).message).toBe(
      "Enter a valid email"
    );
    expect(failure(createAdminBody, { email: "a@b.co", password: "short" }).message).toContain("at least 12");
  });

  it("refuses ids that could change a Firestore path", () => {
    expect(failure(idParams, { id: "a/b" }).status).toBe(400);
    expect(parse(idParams, { id: "abc123" })).toEqual({ id: "abc123" });
  });
});

describe("respondToRequestBody", () => {
  it("defaults to offering 1 unit", () => {
    expect(parse(respondToRequestBody, {})).toEqual({ unitsOffered: 1 });
    expect(parse(respondToRequestBody, { unitsOffered: 3 })).toEqual({ unitsOffered: 3 });
  });

  it.each([
    ["a zero units offered", { unitsOffered: 0 }, "Enter how many units"],
    ["a fractional units offered", { unitsOffered: 1.5 }, "whole number"],
    ["too many units offered", { unitsOffered: 21 }, "most you can offer"],
  ])("rejects %s", (_name, patch, message) => {
    expect(failure(respondToRequestBody, patch).message).toContain(message);
  });
});

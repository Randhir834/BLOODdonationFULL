import { describe, expect, it } from "vitest";
import { emptyProfile, profileBody, validateProfile } from "./orgForm";

const filled = (over = {}) => ({
  ...emptyProfile(),
  name: "City Blood Bank",
  registrationNumber: "BB-1",
  address: "1 MG Road",
  city: "Bengaluru",
  ...over,
});

describe("registering", () => {
  it("needs the name, registration number, address and city", () => {
    const errors = validateProfile(emptyProfile(), { editing: false });
    expect(Object.keys(errors).sort()).toEqual(["address", "city", "name", "registrationNumber"]);
  });

  it("accepts the basics", () => {
    expect(validateProfile(filled(), { editing: false })).toEqual({});
  });

  it("checks the email and the phone numbers when they are given", () => {
    const errors = validateProfile(filled({ email: "nope", alternatePhone: "123" }), { editing: false });
    expect(errors.email).toMatch(/valid email/);
    expect(errors.alternatePhone).toMatch(/10-digit/);
  });

  it("sends everything, with empty optional fields as empty text and a real E.164 number", () => {
    const body = profileBody(filled({ alternatePhone: "9876543210", open24x7: "true" }), { editing: false });
    expect(body).toMatchObject({
      name: "City Blood Bank",
      registrationNumber: "BB-1",
      city: "Bengaluru",
      state: "",
      email: "",
      emergencyPhone: "",
      alternatePhone: "+919876543210",
      open24x7: true,
    });
  });

  it("does not mark an organisation open all day unless it says so", () => {
    expect(profileBody(filled(), { editing: false }).open24x7).toBe(false);
  });
});

describe("editing", () => {
  it("starts blank and asks for nothing", () => {
    expect(validateProfile(emptyProfile(), { editing: true })).toEqual({});
    expect(profileBody(emptyProfile(), { editing: true })).toEqual({});
  });

  it("sends only what was typed, trimmed", () => {
    const body = profileBody({ ...emptyProfile(), state: "  Karnataka ", email: "a@b.co" }, { editing: true });
    expect(body).toEqual({ state: "Karnataka", email: "a@b.co" });
  });

  it("sends the 24 hours choice only when one was made", () => {
    expect(profileBody({ ...emptyProfile(), open24x7: "false" }, { editing: true })).toEqual({ open24x7: false });
  });

  it("still checks what was typed", () => {
    expect(validateProfile({ ...emptyProfile(), email: "bad" }, { editing: true }).email).toBeTruthy();
  });
});

import { describe, expect, it } from "vitest";
import { awaitingApproval } from "./approval";

describe("awaitingApproval", () => {
  it.each(["hospital", "organisation"])("holds back a %s that is pending or rejected", (role) => {
    expect(awaitingApproval({ role, verification: "pending" })).toBe(true);
    expect(awaitingApproval({ role, verification: "rejected" })).toBe(true);
  });

  it.each(["hospital", "organisation"])("lets an approved %s in", (role) => {
    expect(awaitingApproval({ role, verification: "approved" })).toBe(false);
  });

  it("lets in accounts created before approval existed", () => {
    expect(awaitingApproval({ role: "organisation" })).toBe(false);
    expect(awaitingApproval({ role: "hospital" })).toBe(false);
  });

  it("never holds back a donor, and has nothing to say without a profile", () => {
    expect(awaitingApproval({ role: "donar", verification: "pending" })).toBe(false);
    expect(awaitingApproval(null)).toBe(false);
  });
});

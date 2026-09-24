import { describe, expect, it } from "vitest";
import { yourPart } from "./requestText";

describe("what the organisation has done about a request", () => {
  it("says how many offers wait on its own request", () => {
    expect(yourPart({ relation: "mine", pendingResponses: 2 })).toBe("2 offers to review");
    expect(yourPart({ relation: "mine", pendingResponses: 1 })).toBe("1 offer to review");
  });

  it("shows progress once some units are confirmed", () => {
    expect(yourPart({ relation: "mine", pendingResponses: 0, unitsConfirmed: 1, unitsRequired: 2 })).toBe("1 of 2 units confirmed");
    expect(yourPart({ relation: "mine", pendingResponses: 0, unitsConfirmed: 0 })).toBe("Raised by you");
  });

  it("follows its own offer through to the blood being issued", () => {
    expect(yourPart({ relation: "city", myResponse: { status: "pending" } })).toBe("Your offer: waiting for the requester");
    expect(yourPart({ relation: "city", myResponse: { status: "confirmed" } })).toBe("Your offer was confirmed");
    expect(yourPart({ relation: "city", myResponse: { status: "confirmed", dispatchedRecordId: "r1" } })).toBe("You issued the blood");
    expect(yourPart({ relation: "city", myResponse: { status: "declined" } })).toBe("Your offer: declined");
  });

  it("otherwise says how the request reached it", () => {
    expect(yourPart({ relation: "city" })).toBe("In your city");
    expect(yourPart({ relation: "addressed" })).toBe("Sent to you");
  });
});

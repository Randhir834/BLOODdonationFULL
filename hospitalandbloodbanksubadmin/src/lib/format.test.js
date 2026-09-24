import { describe, expect, it } from "vitest";
import { daysUntil, fmtAgo, fmtMl, fmtRelativeDay, formatPhone, nameOf, orgName } from "./format";

const now = new Date("2026-09-24T12:00:00Z");

describe("format", () => {
  it("writes amounts of blood with a thousands separator", () => {
    expect(fmtMl(1200)).toBe(`${(1200).toLocaleString()} ML`);
    expect(fmtMl(undefined)).toBe("0 ML");
  });

  it("counts whole days to an expiry date and says it in words", () => {
    expect(daysUntil("2026-09-27T12:00:00Z", now)).toBe(3);
    expect(fmtRelativeDay("2026-09-27T12:00:00Z", now)).toBe("in 3 days");
    expect(fmtRelativeDay("2026-09-25T12:00:00Z", now)).toBe("tomorrow");
    expect(fmtRelativeDay("2026-09-24T12:00:00Z", now)).toBe("today");
    expect(fmtRelativeDay("2026-09-21T12:00:00Z", now)).toBe("3 days ago");
    expect(fmtRelativeDay(null, now)).toBe("-");
  });

  it("says how long ago something happened", () => {
    expect(fmtAgo("2026-09-24T11:59:40Z", now)).toBe("Just now");
    expect(fmtAgo("2026-09-24T11:30:00Z", now)).toBe("30 min ago");
    expect(fmtAgo("2026-09-24T07:00:00Z", now)).toBe("5 h ago");
    expect(fmtAgo("2026-09-22T12:00:00Z", now)).toBe("2 days ago");
  });

  it("names an account whichever kind it is, and a deleted one plainly", () => {
    expect(nameOf({ hospitalName: "General" })).toBe("General");
    expect(nameOf({ organisationName: "City Blood Bank" })).toBe("City Blood Bank");
    expect(nameOf({ name: "Asha" })).toBe("Asha");
    expect(nameOf(null)).toBe("Deleted account");
    expect(orgName({ organisationName: "City Blood Bank" })).toBe("City Blood Bank");
  });

  it("groups an Indian mobile number and leaves others alone", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
    expect(formatPhone("+14155550100")).toBe("+14155550100");
  });
});

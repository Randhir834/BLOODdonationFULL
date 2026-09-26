import { describe, expect, it } from "vitest";
import { fmtDateTime, fmtMl, fmtNum, nameOf, fmtAgo } from "./format";

describe("format helpers", () => {
  it("formats numbers and millilitres", () => {
    expect(fmtNum(1234567)).toBe((1234567).toLocaleString());
    expect(fmtNum(undefined)).toBe("0");
    expect(fmtMl(450)).toBe("450 ML");
  });

  it("shows a dash for a missing date", () => {
    expect(fmtDateTime("")).toBe("-");
    expect(fmtDateTime("2026-09-22T10:30:00Z")).not.toBe("-");
  });

  it("names a user by whichever role field they have", () => {
    expect(nameOf({ name: "Asha" })).toBe("Asha");
    expect(nameOf({ hospitalName: "City Hospital" })).toBe("City Hospital");
    expect(nameOf({ organisationName: "Red Cross" })).toBe("Red Cross");
    expect(nameOf({ phone: "+919876543210" })).toBe("+919876543210");
    expect(nameOf(null)).toBe("Deleted user");
  });
});

describe("fmtAgo", () => {
  const now = new Date("2026-09-24T12:00:00Z");
  it("counts minutes, hours and days, then falls back to the date", () => {
    expect(fmtAgo("2026-09-24T11:59:50Z", now)).toBe("Just now");
    expect(fmtAgo("2026-09-24T11:20:00Z", now)).toBe("40 min ago");
    expect(fmtAgo("2026-09-24T09:00:00Z", now)).toBe("3 h ago");
    expect(fmtAgo("2026-09-19T12:00:00Z", now)).toBe("5 days ago");
    expect(fmtAgo("", now)).toBe("-");
  });
});

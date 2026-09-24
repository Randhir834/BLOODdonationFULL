import { describe, expect, it } from "vitest";
import { fmtDateTime, fmtMl, fmtNum, nameOf } from "./format";

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

import { describe, expect, it } from "vitest";
import { COUNTRIES, toE164 } from "./phone";

describe("toE164", () => {
  it("adds the country code and drops spaces, dashes and a leading zero", () => {
    expect(toE164("98765 43210", "+91")).toBe("+919876543210");
    expect(toE164("09876-543210", "+91")).toBe("+919876543210");
  });

  it("keeps a number that already has a country code", () => {
    expect(toE164("+971 50 123 4567")).toBe("+971501234567");
  });

  it("rejects numbers that are too short, too long or not numbers", () => {
    expect(toE164("12345", "+91")).toBeNull();
    expect(toE164("+1234567890123456")).toBeNull();
    expect(toE164("abcdefghij", "+91")).toBeNull();
    expect(toE164("", "+91")).toBeNull();
  });
});

describe("COUNTRIES", () => {
  it("gives every country a dial code and a national number length", () => {
    Object.values(COUNTRIES).forEach((country) => {
      expect(country.code).toMatch(/^\+\d{1,3}$/);
      expect(country.digits).toBeGreaterThanOrEqual(8);
    });
  });
});

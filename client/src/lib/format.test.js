import { describe, expect, it } from "vitest";
import { dayHeading, daysUntil, fmtAgo, formatPhone, groupByDay, initialOf, nameOf } from "./format";

describe("nameOf", () => {
  it("uses the name field of whichever role the user has", () => {
    expect(nameOf({ name: "Asha" })).toBe("Asha");
    expect(nameOf({ hospitalName: "City Hospital" })).toBe("City Hospital");
    expect(nameOf({ organisationName: "Red Cross" })).toBe("Red Cross");
  });

  it("falls back to the phone number, then to a label for deleted users", () => {
    expect(nameOf({ phone: "+919876543210" })).toBe("+919876543210");
    expect(nameOf(null)).toBe("Deleted user");
  });

  it("initialOf gives the first letter in capitals", () => {
    expect(initialOf({ name: "  asha" })).toBe("A");
  });
});

describe("formatPhone", () => {
  it("groups numbers from any of the app's supported countries, not only India", () => {
    expect(formatPhone("+917779993958")).toBe("+91 77799 93958");
    expect(formatPhone("+14155550123")).toBe("+1 41555 50123");
    expect(formatPhone("+971501234567")).toBe("+971 50123 4567");
    expect(formatPhone(undefined)).toBe("");
  });

  it("leaves a number from an unrecognised country code or of the wrong length unformatted", () => {
    expect(formatPhone("+330123456789")).toBe("+330123456789");
    expect(formatPhone("+9198765")).toBe("+9198765");
  });
});

describe("day headings", () => {
  const now = new Date(2026, 8, 22, 12, 0, 0);

  it("names today and yesterday", () => {
    expect(dayHeading(new Date(2026, 8, 22, 9, 0, 0).toISOString(), now)).toBe("Today");
    expect(dayHeading(new Date(2026, 8, 21, 23, 0, 0).toISOString(), now)).toBe("Yesterday");
  });

  it("adds the year only for other years", () => {
    expect(dayHeading(new Date(2026, 0, 5).toISOString(), now)).not.toMatch(/2026/);
    expect(dayHeading(new Date(2025, 0, 5).toISOString(), now)).toMatch(/2025/);
  });

  it("groups newest-first rows by day, keeping order", () => {
    const today = new Date().toISOString();
    const rows = [
      { id: 1, createdAt: today },
      { id: 2, createdAt: today },
    ];
    const groups = groupByDay(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ heading: "Today", rows });
  });
});

describe("fmtAgo", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  it("counts minutes, then hours, then falls back to the day", () => {
    expect(fmtAgo("2026-09-23T11:59:40Z", now)).toBe("Just now");
    expect(fmtAgo("2026-09-23T11:18:00Z", now)).toBe("42 min ago");
    expect(fmtAgo("2026-09-23T09:00:00Z", now)).toBe("3 h ago");
    expect(fmtAgo("", now)).toBe("");
  });
});

describe("daysUntil", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  it("rounds a part day up, and goes negative once the date has passed", () => {
    expect(daysUntil("2026-09-24T00:00:00Z", now)).toBe(1);
    expect(daysUntil("2026-09-30T12:00:00Z", now)).toBe(7);
    expect(daysUntil("2026-09-20T12:00:00Z", now)).toBeLessThan(0);
  });
});

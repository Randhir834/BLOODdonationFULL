import { describe, expect, it } from "vitest";
import { distanceKm, fmtDistance, sortByDistance } from "./geo";

describe("distanceKm", () => {
  it("is zero for the same point", () => {
    expect(distanceKm({ lat: 12.9, lng: 77.6 }, { lat: 12.9, lng: 77.6 })).toBeCloseTo(0, 5);
  });

  it("matches a known distance (roughly Delhi to Mumbai, ~1150 km)", () => {
    const delhi = { lat: 28.6139, lng: 77.209 };
    const mumbai = { lat: 19.076, lng: 72.8777 };
    expect(distanceKm(delhi, mumbai)).toBeGreaterThan(1100);
    expect(distanceKm(delhi, mumbai)).toBeLessThan(1200);
  });

  it("is null when either point is missing", () => {
    expect(distanceKm(null, { lat: 1, lng: 1 })).toBeNull();
    expect(distanceKm({ lat: 1, lng: 1 }, null)).toBeNull();
  });
});

describe("fmtDistance", () => {
  it("shows metres under a km, km otherwise", () => {
    expect(fmtDistance(0.8)).toBe("800 m");
    expect(fmtDistance(4.25)).toBe("4.3 km");
    expect(fmtDistance(null)).toBe("");
  });
});

describe("sortByDistance", () => {
  const origin = { lat: 0, lng: 0 };
  const near = { _id: "near", location: { lat: 0.01, lng: 0 } };
  const far = { _id: "far", location: { lat: 1, lng: 0 } };
  const unknown = { _id: "unknown", location: null };

  it("orders nearest first and puts entities with no location last", () => {
    const sorted = sortByDistance([far, unknown, near], origin);
    expect(sorted.map((row) => row._id)).toEqual(["near", "far", "unknown"]);
  });

  it("leaves the order unchanged when there is no origin", () => {
    const sorted = sortByDistance([far, near], null);
    expect(sorted.map((row) => row._id)).toEqual(["far", "near"]);
  });
});

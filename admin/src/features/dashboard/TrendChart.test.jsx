import { describe, expect, it } from "vitest";
import { niceMax } from "./TrendChart";

describe("niceMax", () => {
  it("rounds the top of the axis up to 1, 2, 5 or 10 times a power of ten", () => {
    expect(niceMax(0)).toBe(1000);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(180)).toBe(200);
    expect(niceMax(450)).toBe(500);
    expect(niceMax(501)).toBe(1000);
    expect(niceMax(3200)).toBe(5000);
  });
});

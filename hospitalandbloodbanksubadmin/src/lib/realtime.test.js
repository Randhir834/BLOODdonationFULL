import { describe, expect, it, vi } from "vitest";
import { consume, onRealtime } from "./realtime";

describe("the live feed", () => {
  it("tells a page when the resource it watches changed, and only that page", () => {
    const stock = vi.fn();
    const requests = vi.fn();
    const stopStock = onRealtime("stock", stock);
    onRealtime("requests", requests);

    const rest = consume('data: {"resource":"stock"}\n\n: ping\n\ndata: {"resour');
    expect(stock).toHaveBeenCalledTimes(1);
    expect(requests).not.toHaveBeenCalled();
    // a frame cut off mid-way is kept for the next chunk
    expect(rest).toBe('data: {"resour');
    consume(`${rest}ce":"requests"}\n\n`);
    expect(requests).toHaveBeenCalledTimes(1);

    stopStock();
    consume('data: {"resource":"stock"}\n\n');
    expect(stock).toHaveBeenCalledTimes(1);
  });

  it("ignores a frame it can not read and carries on", () => {
    const seen = vi.fn();
    onRealtime("dashboard", seen);
    consume('data: not json\n\ndata: {"resource":"dashboard"}\n\n');
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

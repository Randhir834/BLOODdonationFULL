import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLoad } from "./useLoad";

describe("useLoad", () => {
  it("loads on mount and exposes the data", async () => {
    const fetcher = vi.fn().mockResolvedValue(["a"]);
    const { result } = renderHook(() => useLoad(fetcher, { type: "in" }));
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(["a"]);
    expect(fetcher).toHaveBeenCalledWith({ type: "in" });
  });

  it("reloads on demand and keeps the old data on screen meanwhile", async () => {
    let resolveSecond;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(["first"])
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));
    const { result } = renderHook(() => useLoad(fetcher));
    await waitFor(() => expect(result.current.data).toEqual(["first"]));

    act(() => {
      result.current.reload();
    });
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.data).toEqual(["first"]);

    await act(async () => resolveSecond(["second"]));
    expect(result.current.data).toEqual(["second"]);
  });

  it("reports the API's message when loading fails", async () => {
    const fetcher = vi.fn().mockRejectedValue({ response: { data: { message: "Access denied" } } });
    const { result } = renderHook(() => useLoad(fetcher));
    await waitFor(() => expect(result.current.error).toBe("Access denied"));
    expect(result.current.loading).toBe(false);
  });

  it("shows the last cached answer straight away, then replaces it with the fresh one", async () => {
    localStorage.clear();
    const fresh = vi.fn().mockResolvedValue(["fresh-1"]);
    const first = renderHook(() => useLoad(fresh, undefined, "test:list"));
    await waitFor(() => expect(first.result.current.data).toEqual(["fresh-1"]));
    first.unmount();

    let resolveNext;
    const slow = vi.fn(() => new Promise((resolve) => (resolveNext = resolve)));
    const { result } = renderHook(() => useLoad(slow, undefined, "test:list"));
    expect(result.current.data).toEqual(["fresh-1"]);
    expect(result.current.loading).toBe(true);

    await act(async () => resolveNext(["fresh-2"]));
    expect(result.current.data).toEqual(["fresh-2"]);
    expect(JSON.parse(localStorage.getItem("bb.cache.test:list:null"))).toEqual(["fresh-2"]);
  });

  it("keeps separate cached answers per params", async () => {
    localStorage.clear();
    const fetcher = vi.fn(async ({ type }) => [type]);
    const a = renderHook(() => useLoad(fetcher, { type: "in" }, "test:typed"));
    await waitFor(() => expect(a.result.current.data).toEqual(["in"]));
    const b = renderHook(() => useLoad(fetcher, { type: "out" }, "test:typed"));
    expect(b.result.current.data).toBeNull();
  });

  it("refetches when the params change and ignores a stale answer", async () => {
    const slow = { resolve: null };
    const fetcher = vi.fn((params) =>
      params.q === "a" ? new Promise((resolve) => (slow.resolve = resolve)) : Promise.resolve(["b-result"])
    );
    const { result, rerender } = renderHook(({ q }) => useLoad(fetcher, { q }), { initialProps: { q: "a" } });

    rerender({ q: "b" });
    await waitFor(() => expect(result.current.data).toEqual(["b-result"]));

    await act(async () => slow.resolve(["a-result"]));
    expect(result.current.data).toEqual(["b-result"]);
  });
});

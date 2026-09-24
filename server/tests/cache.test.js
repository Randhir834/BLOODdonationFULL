import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTokenVerifier } from "../src/services/tokenService.js";
import { HttpError } from "../src/utils/HttpError.js";
import { createTtlCache } from "../src/utils/ttlCache.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createTtlCache", () => {
  it("reuses a result until it expires, then loads again", async () => {
    const cache = createTtlCache(1000);
    const load = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    expect(await cache.get("k", load)).toBe("a");
    expect(await cache.get("k", load)).toBe("a");
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1001);
    expect(await cache.get("k", load)).toBe("b");
  });

  it("shares one load between callers that ask at the same time", async () => {
    const cache = createTtlCache(1000);
    const load = vi.fn(async () => "x");
    await Promise.all([cache.get("k", load), cache.get("k", load), cache.get("k", load)]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not keep failures or empty results", async () => {
    const cache = createTtlCache(1000);
    const failing = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("ok");
    await expect(cache.get("k", failing)).rejects.toThrow("boom");
    expect(await cache.get("k", failing)).toBe("ok");

    const missing = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 1 });
    expect(await cache.get("u", missing)).toBeNull();
    expect(await cache.get("u", missing)).toEqual({ id: 1 });
  });

  it("forgets a key on request", async () => {
    const cache = createTtlCache(1000);
    const load = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    await cache.get("k", load);
    cache.delete("k");
    expect(await cache.get("k", load)).toBe("b");
  });

  it("caches nothing when the ttl is 0", async () => {
    const cache = createTtlCache(0);
    const load = vi.fn(async () => "x");
    await cache.get("k", load);
    await cache.get("k", load);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("createTokenVerifier", () => {
  const decoded = (expiresInSeconds) => ({ uid: "u1", exp: Math.floor(Date.now() / 1000) + expiresInSeconds });

  it("checks a token with Firebase once, then reuses the answer", async () => {
    const verify = vi.fn(async () => decoded(3600));
    const verifyIdToken = createTokenVerifier({ verify, ttlMs: 30_000 });
    await verifyIdToken("t1");
    await verifyIdToken("t1");
    await verifyIdToken("t2");
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it("never serves a token past its own expiry, even inside the cache window", async () => {
    const verify = vi
      .fn()
      .mockResolvedValueOnce(decoded(5))
      .mockRejectedValueOnce(Object.assign(new Error("expired"), { code: "auth/id-token-expired" }));
    const verifyIdToken = createTokenVerifier({ verify, ttlMs: 30_000 });
    await verifyIdToken("t1");
    vi.advanceTimersByTime(10_000);
    await expect(verifyIdToken("t1")).rejects.toMatchObject({ status: 401 });
    expect(verify).toHaveBeenCalledTimes(2);
  });

  it("turns a credential problem into a 401 and passes other errors through, without caching either", async () => {
    const verify = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("revoked"), { code: "auth/id-token-revoked" }))
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(decoded(3600));
    const verifyIdToken = createTokenVerifier({ verify, ttlMs: 30_000 });
    const first = await verifyIdToken("t").catch((error) => error);
    expect(first).toBeInstanceOf(HttpError);
    expect(first.status).toBe(401);
    await expect(verifyIdToken("t")).rejects.toThrow("network down");
    expect(await verifyIdToken("t")).toMatchObject({ uid: "u1" });
  });
});

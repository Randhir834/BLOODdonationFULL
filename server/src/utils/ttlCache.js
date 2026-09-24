/**
 * A small in-memory cache of async lookups. Concurrent callers for the same key share one in-flight
 * load, and a finished result is reused for `ttlMs`. A `ttlMs` of 0 turns caching off entirely. Failed
 * loads and empty (null/undefined) results are never kept, so a user who does not exist yet is looked up
 * again on the next call rather than being remembered as missing.
 */
export const createTtlCache = (ttlMs, maxEntries = 1000) => {
  const entries = new Map();

  const trim = () => {
    const now = Date.now();
    for (const [key, entry] of entries) if (entry.expires <= now) entries.delete(key);
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
  };

  return {
    get(key, load) {
      if (!(ttlMs > 0)) return load();
      const hit = entries.get(key);
      if (hit && hit.expires > Date.now()) return hit.promise;

      const entry = { promise: null, expires: Date.now() + ttlMs };
      entry.promise = Promise.resolve()
        .then(load)
        .then(
          (value) => {
            if ((value === null || value === undefined) && entries.get(key) === entry) entries.delete(key);
            return value;
          },
          (error) => {
            if (entries.get(key) === entry) entries.delete(key);
            throw error;
          }
        );
      entries.set(key, entry);
      if (entries.size > maxEntries) trim();
      return entry.promise;
    },
    delete: (key) => entries.delete(key),
    clear: () => entries.clear(),
  };
};

// The last answer for a screen, kept in memory and on the device, so opening the app or a tab shows what
// was there last time straight away while fresh data loads behind it (see useLoad's `cacheKey`). It is
// wiped whenever the signed-in user changes or signs out (see app/store.js), so it never shows one
// person's data to another.
const PREFIX = "bb.cache.";
const memory = new Map();

export const readCache = (key) => {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw !== null) {
      const value = JSON.parse(raw);
      memory.set(key, value);
      return value;
    }
  } catch {
    // storage unavailable or unreadable: behave as if nothing was cached
  }
  return undefined;
};

export const writeCache = (key, value) => {
  memory.set(key, value);
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // storage full or unavailable: the in-memory copy still works for this session
  }
};

export const clearCache = () => {
  memory.clear();
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // nothing to clear
  }
};

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // Caching is off in tests so a test that signs in as someone else is never served the previous profile.
    env: { NODE_ENV: "test", LOG_LEVEL: "silent", AUTH_CACHE_TTL_MS: "0" },
  },
});

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { notify } from "../lib/notify";

// Tests must not depend on the developer's local .env.
vi.stubEnv("VITE_AUTH_MODE", "otp");
vi.stubEnv("VITE_SMS_COUNTRIES", "IN");

afterEach(() => {
  cleanup();
  // A message shown by one test must not still be on screen in the next. (Some tests replace notify with a stub.)
  notify.clear?.();
});

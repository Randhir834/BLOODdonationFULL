import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { notify } from "../lib/notify";

// jsdom has no layout engine, so charts get a stand-in that never reports a size.
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
  // A message shown by one test must not still be on screen in the next. (Some tests replace notify with a stub.)
  notify.clear?.();
});

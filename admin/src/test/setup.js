import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no layout engine, so charts get a stand-in that never reports a size.
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};

afterEach(cleanup);

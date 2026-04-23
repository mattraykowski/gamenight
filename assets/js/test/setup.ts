import "@testing-library/jest-dom/vitest";
import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import * as axeMatchers from "vitest-axe/matchers";

expect.extend(axeMatchers);

// Radix UI primitives (e.g. Checkbox, Dialog) use ResizeObserver for
// layout-effect measurements, but jsdom ships without it. Provide a
// no-op shim so those components render without throwing.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverShim {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverShim as unknown as typeof ResizeObserver;
}

// TanStack Router's scroll-restoration effect calls `window.scrollTo`,
// which jsdom stubs with a not-implemented warning. Silence it by
// replacing the stub with a no-op.
if (typeof window !== "undefined") {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
}

afterEach(() => {
  cleanup();
});

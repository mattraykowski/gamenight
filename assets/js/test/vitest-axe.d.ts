import "vitest";
import type { AxeResults } from "axe-core";

interface AxeMatchers<R = unknown> {
  toHaveNoViolations(): R;
}

declare module "vitest" {
  interface Assertion<T = unknown> extends AxeMatchers<T> {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}

declare module "vitest-axe" {
  export function axe(container: Element | Document): Promise<AxeResults>;
}

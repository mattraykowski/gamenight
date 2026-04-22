import { axe } from "vitest-axe";
import { expect } from "vitest";

export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe(container);
  expect(results).toHaveNoViolations();
}

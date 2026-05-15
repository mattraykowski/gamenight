import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "@/test/render-route";
import { expectNoAxeViolations } from "@/test/a11y";
import { FeatureHighlights } from "./feature-highlights";

describe("<FeatureHighlights>", () => {
  it("renders a section heading", async () => {
    renderRoute(FeatureHighlights, { path: "/" });
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
    });
  });

  it("renders exactly four highlight items", async () => {
    const { container } = renderRoute(FeatureHighlights, { path: "/" });
    await waitFor(() => screen.getByRole("heading", { level: 2 }));
    const items = container.querySelectorAll("[data-testid='feature-highlight']");
    expect(items.length).toBe(4);
  });

  it("renders the four highlight titles from the route contract", async () => {
    renderRoute(FeatureHighlights, { path: "/" });
    await waitFor(() => {
      expect(screen.getByText(/Monthly scheduling/i)).toBeInTheDocument();
      expect(screen.getByText(/Rosters & characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Player-side availability/i)).toBeInTheDocument();
      expect(screen.getByText(/Notifications/i)).toBeInTheDocument();
    });
  });

  it("has no serious or critical accessibility violations", async () => {
    const { container } = renderRoute(FeatureHighlights, { path: "/" });
    await waitFor(() => screen.getByRole("heading", { level: 2 }));
    await expectNoAxeViolations(container);
  });
});

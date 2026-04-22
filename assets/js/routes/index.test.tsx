import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "@/test/render-route";
import { expectNoAxeViolations } from "@/test/a11y";
import { Route } from "./index";

describe("/ home route", () => {
  it("renders the GameNight heading", async () => {
    renderRoute(Route.options.component!, { path: "/" });
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /GameNight/i })).toBeInTheDocument();
    });
  });

  it("renders a Sign in call-to-action for anonymous visitors", async () => {
    renderRoute(Route.options.component!, { path: "/" });
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it("has a focusable page heading (required for route-change focus management)", async () => {
    renderRoute(Route.options.component!, { path: "/" });
    await waitFor(() => {
      const heading = screen.getByRole("heading", { level: 1, name: /GameNight/i });
      expect(heading).toHaveAttribute("data-route-heading");
      expect(heading).toHaveAttribute("tabIndex", "-1");
    });
  });

  it("has no serious or critical accessibility violations", async () => {
    const { container } = renderRoute(Route.options.component!, { path: "/" });
    await waitFor(() => screen.getByRole("heading", { level: 1 }));
    await expectNoAxeViolations(container);
  });
});

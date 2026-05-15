import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "@/test/render-route";
import { expectNoAxeViolations } from "@/test/a11y";
import { LandingHero } from "./landing-hero";

describe("<LandingHero>", () => {
  it("renders the GameNight wordmark as the page h1 with data-route-heading", async () => {
    renderRoute(LandingHero, { path: "/" });
    await waitFor(() => {
      const h1 = screen.getByRole("heading", { level: 1, name: /GameNight/i });
      expect(h1).toHaveAttribute("data-route-heading");
      expect(h1).toHaveAttribute("tabIndex", "-1");
    });
  });

  it("renders the tagline copy from the route contract", async () => {
    renderRoute(LandingHero, { path: "/" });
    await waitFor(() => {
      expect(
        screen.getByText(/Run your tabletop campaign with confidence/i),
      ).toBeInTheDocument();
    });
  });

  it("renders exactly three value-prop bullets", async () => {
    const { container } = renderRoute(LandingHero, { path: "/" });
    await waitFor(() => screen.getByRole("heading", { level: 1 }));
    const bullets = container.querySelectorAll("[data-testid='hero-value-props'] > li");
    expect(bullets.length).toBe(3);
  });

  it("renders a primary 'Register' CTA pointing to /register", async () => {
    renderRoute(LandingHero, { path: "/" });
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /^Register$/i });
      expect(link.getAttribute("href")).toMatch(/^\/register/);
    });
  });

  it("renders a secondary 'Sign in' affordance pointing to /sign-in", async () => {
    renderRoute(LandingHero, { path: "/" });
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /sign in/i });
      expect(link.getAttribute("href")).toMatch(/^\/sign-in/);
    });
  });

  it("preserves URL query parameters when navigating to /register", async () => {
    renderRoute(LandingHero, { path: "/", initialEntries: ["/?invite=abc123"] });
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /^Register$/i });
      expect(link.getAttribute("href")).toBe("/register?invite=abc123");
    });
  });

  it("preserves URL query parameters when navigating to /sign-in", async () => {
    renderRoute(LandingHero, { path: "/", initialEntries: ["/?invite=abc123"] });
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /sign in/i });
      expect(link.getAttribute("href")).toBe("/sign-in?invite=abc123");
    });
  });

  it("has no serious or critical accessibility violations", async () => {
    const { container } = renderRoute(LandingHero, { path: "/" });
    await waitFor(() => screen.getByRole("heading", { level: 1 }));
    await expectNoAxeViolations(container);
  });
});

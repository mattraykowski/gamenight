import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "@/test/render-route";
import { expectNoAxeViolations } from "@/test/a11y";
import { siteConfig } from "@/lib/config/site-config";
import { MarketingFooter } from "./marketing-footer";

describe("<MarketingFooter>", () => {
  it("renders a <footer> contentinfo landmark", async () => {
    renderRoute(MarketingFooter, { path: "/" });
    await waitFor(() => {
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });
  });

  it("renders a copyright line containing the current year", async () => {
    renderRoute(MarketingFooter, { path: "/" });
    const year = String(new Date().getFullYear());
    await waitFor(() => {
      expect(screen.getByRole("contentinfo")).toHaveTextContent(year);
    });
  });

  it("links Privacy to /privacy", async () => {
    renderRoute(MarketingFooter, { path: "/" });
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /^Privacy$/i });
      expect(link.getAttribute("href")).toMatch(/^\/privacy/);
    });
  });

  it("links Terms to /terms", async () => {
    renderRoute(MarketingFooter, { path: "/" });
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /^Terms$/i });
      expect(link.getAttribute("href")).toMatch(/^\/terms/);
    });
  });

  it("renders the Contact mailto sourced from siteConfig", async () => {
    renderRoute(MarketingFooter, { path: "/" });
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /^Contact$/i });
      expect(link).toHaveAttribute("href", `mailto:${siteConfig.contactEmail}`);
    });
  });

  it("each text link has py-2 padding for ≥24px target size (WCAG 2.5.8)", async () => {
    renderRoute(MarketingFooter, { path: "/" });
    await waitFor(() => screen.getByRole("contentinfo"));
    const linkNames = [/^Privacy$/i, /^Terms$/i, /^Contact$/i];
    for (const name of linkNames) {
      const link = screen.getByRole("link", { name });
      expect(link.className).toMatch(/\bpy-2\b/);
    }
  });

  it("has no serious or critical accessibility violations", async () => {
    const { container } = renderRoute(MarketingFooter, { path: "/" });
    await waitFor(() => screen.getByRole("contentinfo"));
    await expectNoAxeViolations(container);
  });
});

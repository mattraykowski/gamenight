import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "@/test/render-route";
import { expectNoAxeViolations } from "@/test/a11y";
import { ClosingCta } from "./closing-cta";

describe("<ClosingCta>", () => {
  it("renders the closing-section heading", async () => {
    renderRoute(ClosingCta, { path: "/" });
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /ready to run/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders the reinforcing line", async () => {
    renderRoute(ClosingCta, { path: "/" });
    await waitFor(() => {
      expect(screen.getByText(/under five minutes/i)).toBeInTheDocument();
    });
  });

  it("renders a primary 'Register' CTA pointing to /register", async () => {
    renderRoute(ClosingCta, { path: "/" });
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /^Register$/i });
      expect(link.getAttribute("href")).toMatch(/^\/register/);
    });
  });

  it("preserves URL query parameters on the Register link", async () => {
    renderRoute(ClosingCta, { path: "/", initialEntries: ["/?invite=xyz"] });
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /^Register$/i });
      expect(link.getAttribute("href")).toBe("/register?invite=xyz");
    });
  });

  it("has no serious or critical accessibility violations", async () => {
    const { container } = renderRoute(ClosingCta, { path: "/" });
    await waitFor(() => screen.getByRole("heading", { level: 2 }));
    await expectNoAxeViolations(container);
  });
});

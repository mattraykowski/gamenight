import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "@/test/render-route";
import { expectNoAxeViolations } from "@/test/a11y";
import { HowItWorks } from "./how-it-works";

describe("<HowItWorks>", () => {
  it("renders a section heading", async () => {
    renderRoute(HowItWorks, { path: "/" });
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { level: 2, name: /how it works/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders an ordered list with exactly three steps", async () => {
    renderRoute(HowItWorks, { path: "/" });
    await waitFor(() => screen.getByRole("heading", { level: 2 }));
    const list = screen.getByRole("list");
    expect(list.tagName.toLowerCase()).toBe("ol");
    expect(list.querySelectorAll("li").length).toBe(3);
  });

  it("renders the three step titles from the route contract", async () => {
    renderRoute(HowItWorks, { path: "/" });
    await waitFor(() => {
      expect(screen.getByText(/Register your game/i)).toBeInTheDocument();
      expect(screen.getByText(/Invite your players/i)).toBeInTheDocument();
      expect(screen.getByText(/Schedule the month/i)).toBeInTheDocument();
    });
  });

  it("has no serious or critical accessibility violations", async () => {
    const { container } = renderRoute(HowItWorks, { path: "/" });
    await waitFor(() => screen.getByRole("heading", { level: 2 }));
    await expectNoAxeViolations(container);
  });
});

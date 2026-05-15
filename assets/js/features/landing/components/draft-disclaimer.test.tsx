import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "@/test/render-route";
import { expectNoAxeViolations } from "@/test/a11y";
import { siteConfig } from "@/lib/config/site-config";
import { DraftDisclaimer } from "./draft-disclaimer";

describe("<DraftDisclaimer>", () => {
  it("renders with role='status' for assistive tech", async () => {
    renderRoute(DraftDisclaimer, { path: "/" });
    await waitFor(() => {
      expect(screen.getByTestId("draft-disclaimer")).toHaveAttribute(
        "role",
        "status",
      );
    });
  });

  it("contains the canonical disclaimer (draft, not legal advice)", async () => {
    renderRoute(DraftDisclaimer, { path: "/" });
    await waitFor(() => {
      expect(screen.getByTestId("draft-disclaimer")).toHaveTextContent(
        /draft.*not legal advice/i,
      );
    });
  });

  it("links the contact mailto from siteConfig", async () => {
    renderRoute(DraftDisclaimer, { path: "/" });
    await waitFor(() => {
      const link = screen.getByRole("link", { name: new RegExp(siteConfig.contactEmail, "i") });
      expect(link).toHaveAttribute("href", `mailto:${siteConfig.contactEmail}`);
    });
  });

  it("has no serious or critical accessibility violations", async () => {
    const { container } = renderRoute(DraftDisclaimer, { path: "/" });
    await waitFor(() => screen.getByTestId("draft-disclaimer"));
    await expectNoAxeViolations(container);
  });
});

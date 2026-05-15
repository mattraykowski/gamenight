import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderRoute } from "@/test/render-route";
import { expectNoAxeViolations } from "@/test/a11y";
import { siteConfig } from "@/lib/config/site-config";
import { termsMeta } from "@/features/landing/content/meta";
import { Route } from "./terms";

describe("/terms route", () => {
  it("renders the Terms of Service h1 with route-change focus markup", async () => {
    renderRoute(Route.options.component!, { path: "/terms" });
    await waitFor(() => {
      const h1 = screen.getByRole("heading", { level: 1, name: /Terms of Service/i });
      expect(h1).toHaveAttribute("data-route-heading");
      expect(h1).toHaveAttribute("tabIndex", "-1");
    });
  });

  it("renders the canonical 'draft, not legal advice' disclaimer", async () => {
    renderRoute(Route.options.component!, { path: "/terms" });
    await waitFor(() => {
      const disclaimer = screen.getByTestId("draft-disclaimer");
      expect(disclaimer).toHaveAttribute("role", "status");
      expect(disclaimer).toHaveTextContent(/draft.*not legal advice/i);
    });
  });

  it("renders a 'Last revised' line", async () => {
    renderRoute(Route.options.component!, { path: "/terms" });
    await waitFor(() => {
      expect(screen.getByText(/last revised/i)).toBeInTheDocument();
    });
  });

  it("renders the structured Terms of Service section headings", async () => {
    renderRoute(Route.options.component!, { path: "/terms" });
    await waitFor(() => screen.getByRole("heading", { level: 1 }));
    expect(screen.getByRole("heading", { name: /Eligibility/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Your account/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /What you can and cannot do/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Your content/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Service availability/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Termination/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Disclaimers/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Limitation of liability/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Changes to these terms/i })).toBeInTheDocument();
  });

  it("renders a Contact mailto sourced from siteConfig", async () => {
    renderRoute(Route.options.component!, { path: "/terms" });
    await waitFor(() => {
      const links = screen.getAllByRole("link", {
        name: new RegExp(siteConfig.contactEmail, "i"),
      });
      const mailto = links.find((l) => l.getAttribute("href") === `mailto:${siteConfig.contactEmail}`);
      expect(mailto).toBeDefined();
    });
  });

  it("renders the marketing footer", async () => {
    renderRoute(Route.options.component!, { path: "/terms" });
    await waitFor(() => {
      expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    });
  });

  it("has no serious or critical accessibility violations", async () => {
    const { container } = renderRoute(Route.options.component!, { path: "/terms" });
    await waitFor(() => screen.getByRole("heading", { level: 1 }));
    await expectNoAxeViolations(container);
  });

  it("emits head() title and description from termsMeta", async () => {
    const head = await Route.options.head?.({} as never);
    const meta = head?.meta ?? [];
    const titleEntry = meta.find(
      (m): m is { title: string } => typeof m === "object" && m !== null && "title" in m,
    );
    const descEntry = meta.find(
      (m): m is { name: string; content: string } =>
        typeof m === "object" && m !== null && (m as { name?: string }).name === "description",
    );
    expect(titleEntry?.title).toBe(termsMeta.title);
    expect(descEntry?.content).toBe(termsMeta.description);
  });

  it("emits Open Graph + Twitter Card meta (article type, reuses landing OG image)", async () => {
    const head = await Route.options.head?.({} as never);
    const meta = (head?.meta ?? []) as Array<Record<string, unknown>>;
    const byProperty = (p: string) =>
      meta.find((m) => m && typeof m === "object" && m.property === p);
    const byName = (n: string) =>
      meta.find((m) => m && typeof m === "object" && m.name === n);

    expect(byProperty("og:title")?.content).toBe(termsMeta.ogTitle);
    expect(byProperty("og:description")?.content).toBe(termsMeta.ogDescription);
    expect(byProperty("og:type")?.content).toBe("article");
    expect(byProperty("og:url")?.content).toBe(`${siteConfig.siteOrigin}/terms`);
    expect(byProperty("og:image")?.content).toBe(
      `${siteConfig.siteOrigin}${termsMeta.ogImagePath}`,
    );
    expect(byName("twitter:card")?.content).toBe("summary_large_image");
    expect(byName("twitter:image")?.content).toBe(
      `${siteConfig.siteOrigin}${termsMeta.ogImagePath}`,
    );
  });
});

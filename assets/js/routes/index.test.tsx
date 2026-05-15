import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/render-route";
import { expectNoAxeViolations } from "@/test/a11y";
import { landingMeta } from "@/features/landing/content/meta";
import { Route } from "./index";

const server = setupServer(
  http.post("*/rpc/run", async ({ request }) => {
    const body = (await request.json()) as { action: string };
    if (body.action === "read_current_user") {
      return HttpResponse.json({
        success: true,
        data: { id: "u1", email: "alice@example.com" },
      });
    }
    return HttpResponse.json({
      success: false,
      errors: [
        {
          type: "unknown",
          message: `unhandled: ${body.action}`,
          shortMessage: "unhandled",
          vars: {},
          fields: [],
          path: [],
        },
      ],
    });
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
});

afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  document.head.innerHTML = "";
});

describe("/ landing route — anonymous", () => {
  it("renders the GameNight hero h1 with route-change focus markup", async () => {
    renderRoute(Route.options.component!, { path: "/" });
    await waitFor(() => {
      const h1 = screen.getByRole("heading", { level: 1, name: /GameNight/i });
      expect(h1).toHaveAttribute("data-route-heading");
      expect(h1).toHaveAttribute("tabIndex", "-1");
    });
  });

  it("renders all five landing sections (hero, how-it-works, features, closing CTA, footer)", async () => {
    renderRoute(Route.options.component!, { path: "/" });
    await waitFor(() => screen.getByRole("heading", { level: 1 }));

    expect(screen.getByRole("heading", { level: 2, name: /how it works/i })).toBeInTheDocument();
    expect(screen.getByText(/Monthly scheduling/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /ready to run/i })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("does NOT render a welcome-back banner when no AuthProvider is mounted", async () => {
    renderRoute(Route.options.component!, { path: "/" });
    await waitFor(() => screen.getByRole("heading", { level: 1 }));
    expect(screen.queryByText(/welcome back/i)).toBeNull();
    expect(screen.queryByRole("link", { name: /go to dashboard/i })).toBeNull();
  });

  it("preserves URL query parameters when navigating to /register", async () => {
    renderRoute(Route.options.component!, {
      path: "/",
      initialEntries: ["/?invite=abc123"],
    });
    await waitFor(() => {
      const links = screen.getAllByRole("link", { name: /^Register$/i });
      links.forEach((link) => {
        expect(link.getAttribute("href")).toBe("/register?invite=abc123");
      });
    });
  });

  it("has no serious or critical accessibility violations", async () => {
    const { container } = renderRoute(Route.options.component!, { path: "/" });
    await waitFor(() => screen.getByRole("heading", { level: 1 }));
    await expectNoAxeViolations(container);
  });
});

describe("/ landing route — authenticated", () => {
  it("renders the welcome-back banner above the hero with the marketing content still visible", async () => {
    renderRoute(Route.options.component!, {
      path: "/",
      authState: { user: { id: "u1", email: "alice@example.com" } },
    });
    await waitFor(() => {
      expect(screen.getByRole("region", { name: /welcome/i })).toBeInTheDocument();
    });
    // Hero, sections, and footer all still render below.
    expect(screen.getByRole("heading", { level: 1, name: /GameNight/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /how it works/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /ready to run/i })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("Go-to-dashboard link points to /dashboard", async () => {
    renderRoute(Route.options.component!, {
      path: "/",
      authState: { user: { id: "u1", email: "alice@example.com" } },
    });
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /go to dashboard/i });
      expect(link.getAttribute("href")).toBe("/dashboard");
    });
  });
});

describe("/ landing route — head metadata", () => {
  it("emits the configured <title> from landingMeta", async () => {
    const head = await Route.options.head?.({} as never);
    const meta = head?.meta ?? [];
    const titleEntry = meta.find(
      (m): m is { title: string } => typeof m === "object" && m !== null && "title" in m,
    );
    expect(titleEntry?.title).toBe(landingMeta.title);
  });

  it("emits a meta description matching landingMeta", async () => {
    const head = await Route.options.head?.({} as never);
    const meta = head?.meta ?? [];
    const descEntry = meta.find(
      (m): m is { name: string; content: string } =>
        typeof m === "object" && m !== null && (m as { name?: string }).name === "description",
    );
    expect(descEntry?.content).toBe(landingMeta.description);
  });

  it("emits Open Graph + Twitter Card meta with absolute image URLs", async () => {
    const { siteConfig } = await import("@/lib/config/site-config");
    const head = await Route.options.head?.({} as never);
    const meta = (head?.meta ?? []) as Array<Record<string, unknown>>;

    const byProperty = (p: string) =>
      meta.find((m) => m && typeof m === "object" && m.property === p);
    const byName = (n: string) =>
      meta.find((m) => m && typeof m === "object" && m.name === n);

    expect(byProperty("og:title")?.content).toBe(landingMeta.ogTitle);
    expect(byProperty("og:description")?.content).toBe(landingMeta.ogDescription);
    expect(byProperty("og:type")?.content).toBe("website");
    expect(byProperty("og:url")?.content).toBe(`${siteConfig.siteOrigin}/`);
    expect(byProperty("og:image")?.content).toBe(
      `${siteConfig.siteOrigin}${landingMeta.ogImagePath}`,
    );
    expect(String(byProperty("og:image:width")?.content)).toBe("1200");
    expect(String(byProperty("og:image:height")?.content)).toBe("630");

    expect(byName("twitter:card")?.content).toBe("summary_large_image");
    expect(byName("twitter:title")?.content).toBe(landingMeta.ogTitle);
    expect(byName("twitter:description")?.content).toBe(landingMeta.ogDescription);
    expect(byName("twitter:image")?.content).toBe(
      `${siteConfig.siteOrigin}${landingMeta.ogImagePath}`,
    );
  });
});

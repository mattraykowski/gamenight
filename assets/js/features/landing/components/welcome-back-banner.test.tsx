import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { renderRoute } from "@/test/render-route";
import { expectNoAxeViolations } from "@/test/a11y";
import { WelcomeBackBanner } from "./welcome-back-banner";

let currentUserResponse: () => Response = () =>
  HttpResponse.json({ success: true, data: { id: "u1", email: "alice@example.com" } });

const server = setupServer(
  http.post("*/rpc/run", async ({ request }) => {
    const body = (await request.json()) as { action: string };
    if (body.action === "read_current_user") {
      return currentUserResponse();
    }
    return HttpResponse.json({
      success: false,
      errors: [{ type: "unknown", message: `unhandled: ${body.action}`, shortMessage: "x", vars: {}, fields: [], path: [] }],
    });
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
});

afterEach(() => {
  server.resetHandlers();
  currentUserResponse = () =>
    HttpResponse.json({ success: true, data: { id: "u1", email: "alice@example.com" } });
});

afterAll(() => {
  server.close();
  document.head.innerHTML = "";
});

describe("<WelcomeBackBanner>", () => {
  it("returns null when no <AuthProvider> is mounted", () => {
    const { container } = renderRoute(WelcomeBackBanner, { path: "/" });
    expect(container.textContent).toBe("");
  });

  it("returns null when auth.isAuthenticated === false", () => {
    const { container } = renderRoute(WelcomeBackBanner, {
      path: "/",
      authState: { user: null },
    });
    expect(container.textContent).toBe("");
  });

  it("renders the banner with a friendly name + Go-to-dashboard link when authenticated", async () => {
    renderRoute(WelcomeBackBanner, {
      path: "/",
      authState: { user: { id: "u1", email: "alice@example.com" } },
    });
    await waitFor(() => {
      expect(screen.getByRole("region", { name: /welcome/i })).toBeInTheDocument();
    });
    await waitFor(() => {
      const region = screen.getByRole("region", { name: /welcome/i });
      expect(region.textContent ?? "").toMatch(/welcome back, alice/i);
    });
    const link = screen.getByRole("link", { name: /go to dashboard/i });
    expect(link.getAttribute("href")).toBe("/dashboard");
  });

  it("falls back to a generic welcome message while useCurrentUser is pending", async () => {
    // Override with a response that never resolves so the query stays pending.
    currentUserResponse = () =>
      new Response(new ReadableStream({ start() {} }), {
        headers: { "Content-Type": "application/json" },
      });
    renderRoute(WelcomeBackBanner, {
      path: "/",
      authState: { user: { id: "u1", email: "alice@example.com" } },
    });
    await waitFor(() => {
      expect(screen.getByRole("region", { name: /welcome/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toBeInTheDocument();
  });

  it("falls back to a generic welcome message on useCurrentUser error", async () => {
    currentUserResponse = () =>
      HttpResponse.json({
        success: false,
        errors: [
          {
            type: "forbidden",
            message: "no",
            shortMessage: "no",
            vars: {},
            fields: [],
            path: [],
          },
        ],
      });
    renderRoute(WelcomeBackBanner, {
      path: "/",
      authState: { user: { id: "u1", email: "alice@example.com" } },
    });
    await waitFor(() => {
      expect(screen.getByRole("region", { name: /welcome/i })).toBeInTheDocument();
    });
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to dashboard/i })).toBeInTheDocument();
  });

  it("has no serious or critical accessibility violations when authenticated", async () => {
    const { container } = renderRoute(WelcomeBackBanner, {
      path: "/",
      authState: { user: { id: "u1", email: "alice@example.com" } },
    });
    await waitFor(() => screen.getByRole("region", { name: /welcome/i }));
    await expectNoAxeViolations(container);
    // Quiet the unused-import lint; vi is the convention for this project.
    void vi;
  });
});

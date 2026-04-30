import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { expectNoAxeViolations } from "@/test/a11y";
import { AuthProvider, type AuthContextValue } from "@/lib/auth/auth-context";
import { ToastProvider } from "@/features/toasts/toast-provider";
import { DashboardRoute } from "./dashboard";

interface DashboardRpcResponses {
  listMyCharacters?: () => Response;
  listMineActive?: () => Response;
  listMine?: () => Response;
}

let dashboardResponses: DashboardRpcResponses = {};

const server = setupServer(
  http.post("*/rpc/run", async ({ request }) => {
    const body = (await request.json()) as { action: string };
    if (body.action === "read_current_user") {
      return HttpResponse.json({
        success: true,
        data: { id: "u1", email: "player@example.com" },
      });
    }
    if (body.action === "list_my_characters" && dashboardResponses.listMyCharacters) {
      return dashboardResponses.listMyCharacters();
    }
    if (body.action === "list_mine_active" && dashboardResponses.listMineActive) {
      return dashboardResponses.listMineActive();
    }
    if (body.action === "list_mine" && dashboardResponses.listMine) {
      return dashboardResponses.listMine();
    }
    // Default fallthrough — empty success so the dashboard's column
    // sections render their empty states without an error banner.
    if (
      body.action === "list_my_characters" ||
      body.action === "list_mine_active" ||
      body.action === "list_mine"
    ) {
      return HttpResponse.json({ success: true, data: [] });
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
  server.listen({ onUnhandledRequest: "error" });
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
});

afterEach(() => {
  server.resetHandlers();
  dashboardResponses = {};
});

afterAll(() => {
  server.close();
  document.head.innerHTML = "";
});

/**
 * Minimum router harness so `DashboardRoute` can read search params
 * and call `useNavigate()`. We mount the component at `/dashboard`,
 * register a catch-all for sign-out navigation, and pass the live
 * auth context down via `RouterProvider` so the authenticated guard
 * does not redirect the test away.
 */
function renderDashboardAt(initialPath = "/dashboard") {
  const rootRoute = createRootRouteWithContext<{ auth?: AuthContextValue }>()({
    component: () => <Outlet />,
  });
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    validateSearch: (
      search: Record<string, unknown>,
    ): { toast?: string } => ({
      toast: typeof search.toast === "string" ? search.toast : undefined,
    }),
    component: DashboardRoute,
  });
  const catchAllRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "$",
    component: () => <div data-testid="elsewhere">elsewhere</div>,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([dashboardRoute, catchAllRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: { auth: undefined },
  });

  function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
      () =>
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: 0 },
            mutations: { retry: false },
          },
        }),
    );
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialState={{ user: { id: "u1", email: "player@example.com" } }}>
          <ToastProvider>
            {children}
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  return render(<></>, { wrapper: Providers });
}

describe("/dashboard route", () => {
  it("renders 'Welcome back, {name}' after the RPC resolves", async () => {
    const { container } = renderDashboardAt();

    await waitFor(() => {
      // Friendly display name is derived from the local-part of the
      // email (the part before the @).
      expect(screen.getByTestId("current-user-email")).toHaveTextContent(
        "player",
      );
    });

    expect(
      screen.getByRole("heading", { level: 1, name: /welcome back, player/i }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("renders a loading announcement before the RPC resolves", async () => {
    renderDashboardAt();

    await waitFor(() =>
      expect(screen.getByText(/loading your account/i)).toBeInTheDocument(),
    );
  });

  it("has a focusable h1 carrying the data-route-heading contract", async () => {
    renderDashboardAt();

    await waitFor(() =>
      screen.getByRole("heading", { level: 1, name: /welcome back/i }),
    );
    const heading = screen.getByRole("heading", {
      level: 1,
      name: /welcome back/i,
    });
    expect(heading).toHaveAttribute("data-route-heading");
    expect(heading).toHaveAttribute("tabIndex", "-1");
  });

  it("renders a toast when ?toast=email_confirmed is in the URL", async () => {
    renderDashboardAt("/dashboard?toast=email_confirmed");

    await waitFor(() =>
      expect(screen.getByTestId("toast-success")).toHaveTextContent(
        /email address has been confirmed/i,
      ),
    );
  });

  it("renders the two-column layout with My Characters and My Games (T102)", async () => {
    renderDashboardAt();

    await waitFor(() =>
      expect(screen.getByTestId("dashboard-columns")).toBeInTheDocument(),
    );

    // Both column headings render alongside each other.
    expect(
      screen.getByRole("heading", { level: 2, name: /my characters/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /campaigns i lead/i }),
    ).toBeInTheDocument();
  });

  it("filters out :done characters from the dashboard list (FR-029)", async () => {
    dashboardResponses.listMyCharacters = () =>
      HttpResponse.json({
        success: true,
        data: [
          {
            id: "p1",
            characterName: "Active Mira",
            characterSummary: null,
            status: "active",
          },
          {
            id: "p2",
            characterName: "Inactive Garrick",
            characterSummary: null,
            status: "inactive",
          },
          {
            id: "p3",
            characterName: "Retired Jaela",
            characterSummary: null,
            status: "done",
          },
        ],
      });

    renderDashboardAt();

    await waitFor(() =>
      expect(screen.getByTestId("my-characters-list")).toBeInTheDocument(),
    );

    expect(screen.getByText("Active Mira")).toBeInTheDocument();
    expect(screen.getByText("Inactive Garrick")).toBeInTheDocument();
    // :done is hidden from the dashboard but reachable via /characters.
    expect(screen.queryByText("Retired Jaela")).not.toBeInTheDocument();
  });

  it("renders the My Characters empty state when the actor has no Player rows", async () => {
    dashboardResponses.listMyCharacters = () =>
      HttpResponse.json({ success: true, data: [] });

    renderDashboardAt();

    await waitFor(() =>
      expect(screen.getByTestId("characters-empty-state")).toBeInTheDocument(),
    );
  });

  it("does not render a toast for unknown ?toast= values", async () => {
    renderDashboardAt("/dashboard?toast=shenanigans");

    await waitFor(() =>
      screen.getByRole("heading", { level: 1, name: /welcome back/i }),
    );
    expect(screen.queryByTestId("toast-viewport")).not.toBeInTheDocument();
  });
});

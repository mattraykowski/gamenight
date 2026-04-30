import { describe, expect, it } from "vitest";
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

import { AuthProvider } from "@/lib/auth/auth-context";
import type { AuthUser } from "@/lib/auth/auth-state";
import type { RouterContext } from "@/routes/__root";
import { AppSidebar } from "./app-sidebar";

function renderSidebarAt(initialPath: string, initialAuth: AuthUser | null) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => (
      <>
        <AppSidebar />
        <Outlet />
      </>
    ),
  });
  const dashRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: () => <div data-testid="page-dashboard">dashboard</div>,
  });
  const calRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/calendar",
    component: () => <div data-testid="page-calendar">calendar</div>,
  });
  const gamesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/games",
    component: () => <div data-testid="page-games">games</div>,
  });
  const newGameRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/games/new",
    component: () => <div data-testid="page-new-game">new game</div>,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      dashRoute,
      calRoute,
      gamesRoute,
      newGameRoute,
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: { auth: undefined, queryClient: new QueryClient() },
  });

  function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialState={{ user: initialAuth }}>
          {children}
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  return render(<></>, { wrapper: Providers });
}

describe("<AppSidebar>", () => {
  it("renders nothing when the visitor is anonymous", async () => {
    renderSidebarAt("/dashboard", null);
    expect(screen.queryByTestId("app-sidebar")).not.toBeInTheDocument();
  });

  it("renders the user-context block + New Quest CTA + primary nav for authenticated users", async () => {
    renderSidebarAt("/dashboard", { id: "u1", email: "keeper@example.com" });

    await waitFor(() =>
      expect(screen.getByTestId("app-sidebar")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("app-sidebar-email")).toHaveTextContent(
      "keeper@example.com",
    );
    expect(screen.getByTestId("app-sidebar-new-quest")).toHaveTextContent(
      /new quest/i,
    );
    expect(
      screen.getByTestId("app-sidebar-link-dashboard"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("app-sidebar-link-calendar"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("app-sidebar-link-games")).toBeInTheDocument();
  });

  it("marks the current route's link with aria-current=page", async () => {
    renderSidebarAt("/dashboard", { id: "u1", email: "k@example.com" });
    await waitFor(() =>
      expect(screen.getByTestId("app-sidebar-link-dashboard")).toBeInTheDocument(),
    );
    expect(
      screen.getByTestId("app-sidebar-link-dashboard"),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByTestId("app-sidebar-link-games"),
    ).not.toHaveAttribute("aria-current");
  });
});

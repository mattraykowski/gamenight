import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import type { AuthUser } from "@/lib/auth/auth-state";
import { ToastProvider } from "@/features/toasts/toast-provider";
import { NavBar } from "./nav-bar";

const server = setupServer(
  http.delete("*/sign-out", () => HttpResponse.json({ ok: true })),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  document.head.innerHTML = "";
});

function renderNavAt(
  initialPath: string,
  initialAuth: AuthUser | null,
) {
  const rootRoute = createRootRouteWithContext<{ auth?: AuthContextValue }>()({
    component: () => (
      <>
        <NavBar />
        <Outlet />
      </>
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div data-testid="page-root">home</div>,
  });
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: () => <div data-testid="page-dashboard">dashboard</div>,
  });
  const gamesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/games",
    component: () => <div data-testid="page-games">all games</div>,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, dashboardRoute, gamesRoute]),
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
        <AuthProvider initialState={{ user: initialAuth }}>
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

describe("<NavBar>", () => {
  it("renders the anonymous variant with Sign in + Register buttons", async () => {
    const { container } = renderNavAt("/", null);

    await waitFor(() => screen.getByTestId("nav-brand"));
    expect(screen.getByTestId("nav-brand")).toHaveTextContent(/gamenight/i);
    expect(screen.getByTestId("nav-sign-in")).toBeInTheDocument();
    expect(screen.getByTestId("nav-register")).toBeInTheDocument();
    expect(screen.queryByTestId("user-menu-trigger")).not.toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it("renders the authenticated variant with primary links + user menu", async () => {
    const { container } = renderNavAt("/dashboard", {
      id: "u1",
      email: "player@example.com",
    });

    await waitFor(() => screen.getByTestId("user-menu-trigger"));
    expect(screen.getByTestId("user-menu-trigger")).toHaveTextContent(
      "player@example.com",
    );
    expect(screen.getByTestId("nav-link-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("nav-link-games")).toBeInTheDocument();
    expect(screen.queryByTestId("nav-sign-in")).not.toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it("marks the current route's nav link with aria-current=page", async () => {
    renderNavAt("/dashboard", { id: "u1", email: "player@example.com" });

    await waitFor(() => screen.getByTestId("nav-link-dashboard"));
    expect(screen.getByTestId("nav-link-dashboard")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("nav-link-games")).not.toHaveAttribute("aria-current");
  });

  it("signs the user out when the user menu's Sign out item is clicked", async () => {
    renderNavAt("/dashboard", { id: "u1", email: "player@example.com" });
    await waitFor(() => screen.getByTestId("user-menu-trigger"));

    const user = userEvent.setup();
    await user.click(screen.getByTestId("user-menu-trigger"));
    await user.click(await screen.findByTestId("user-menu-sign-out"));

    await waitFor(() =>
      expect(screen.getByTestId("nav-sign-in")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("user-menu-trigger")).not.toBeInTheDocument();
  });
});

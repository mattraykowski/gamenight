import { render, type RenderResult } from "@testing-library/react";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { A11yAnnouncer } from "@/lib/a11y/announcer";
import { AuthProvider } from "@/lib/auth/auth-context";
import type { AuthState } from "@/lib/auth/auth-state";

interface RouterContext {
  queryClient: QueryClient;
}

interface RenderRouteOptions {
  path?: string;
  initialEntries?: string[];
  /**
   * When provided, wraps the render in an `<AuthProvider>` seeded with
   * this initial auth state. Tests for components that branch on
   * `useOptionalAuth()` use this to flip between anonymous and
   * authenticated renders without going through the JSON island.
   */
  authState?: AuthState;
}

/**
 * Renders a single route component inside a test-configured TanStack Router
 * + React Query context. Returns the RTL render result so callers can
 * use screen/within/container as usual.
 */
export function renderRoute(
  ui: ComponentType<Record<string, unknown>>,
  { path = "/", initialEntries = [path], authState }: RenderRouteOptions = {},
): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => (
      <A11yAnnouncer>
        <Outlet />
      </A11yAnnouncer>
    ),
  });

  const testRoute = createRoute({
    getParentRoute: () => rootRoute,
    path,
    // TanStack Router's RouteComponent type is internal; tests pass any component.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: ui as unknown as any,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([testRoute]),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries }),
  });

  const tree = (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );

  return render(
    authState ? <AuthProvider initialState={authState}>{tree}</AuthProvider> : tree,
  );
}

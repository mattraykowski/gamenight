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

interface RouterContext {
  queryClient: QueryClient;
}

interface RenderRouteOptions {
  path?: string;
  initialEntries?: string[];
}

/**
 * Renders a single route component inside a test-configured TanStack Router
 * + React Query context. Returns the RTL render result so callers can
 * use screen/within/container as usual.
 */
export function renderRoute(
  ui: ComponentType<Record<string, unknown>>,
  { path = "/", initialEntries = [path] }: RenderRouteOptions = {},
): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
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

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

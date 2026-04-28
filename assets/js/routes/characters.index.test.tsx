import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
import { CharactersRoute } from "./characters.index";

interface RpcResponses {
  listMyCharacters?: () => Response;
}

let responses: RpcResponses = {};

const server = setupServer(
  http.post("*/rpc/run", async ({ request }) => {
    const body = (await request.json()) as { action: string };
    if (body.action === "list_my_characters" && responses.listMyCharacters) {
      return responses.listMyCharacters();
    }
    return HttpResponse.json({ success: true, data: [] });
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
});

beforeEach(() => {
  responses = {};
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  document.head.innerHTML = "";
});

function renderRoute() {
  const rootRoute = createRootRouteWithContext<{ auth?: AuthContextValue }>()({
    component: () => <Outlet />,
  });
  const charactersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/characters",
    component: CharactersRoute,
  });
  const signInRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sign-in",
    validateSearch: (
      search: Record<string, unknown>,
    ): { redirect?: string } => ({
      redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    }),
    component: () => <div data-testid="signin-stub">sign-in</div>,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([charactersRoute, signInRoute]),
    history: createMemoryHistory({ initialEntries: ["/characters"] }),
    context: {
      auth: {
        user: { id: "u1", email: "player@example.com" },
        isAuthenticated: true,
        setUser: () => {},
        clearAuth: () => {},
      } as AuthContextValue,
    },
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
          {children}
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  return render(<></>, { wrapper: Providers });
}

describe("/characters route", () => {
  it("renders every player record regardless of status (T103)", async () => {
    responses.listMyCharacters = () =>
      HttpResponse.json({
        success: true,
        data: [
          { id: "p1", characterName: "Active Mira", characterSummary: null, status: "active" },
          {
            id: "p2",
            characterName: "Inactive Garrick",
            characterSummary: null,
            status: "inactive",
          },
          {
            id: "p3",
            characterName: "Retired Jaela",
            characterSummary: "Retired after the Strahd campaign.",
            status: "done",
          },
        ],
      });

    const { container } = renderRoute();

    await waitFor(() =>
      expect(screen.getByTestId("all-characters-list")).toBeInTheDocument(),
    );

    // All three statuses appear here — including :done, which is hidden
    // from the dashboard.
    expect(screen.getByText("Active Mira")).toBeInTheDocument();
    expect(screen.getByText("Inactive Garrick")).toBeInTheDocument();
    expect(screen.getByText("Retired Jaela")).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it("renders the empty state when the actor has no Player rows", async () => {
    responses.listMyCharacters = () =>
      HttpResponse.json({ success: true, data: [] });

    const { container } = renderRoute();

    await waitFor(() =>
      expect(screen.getByTestId("characters-empty-state")).toBeInTheDocument(),
    );

    await expectNoAxeViolations(container);
  });
});

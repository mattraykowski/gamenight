import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
import { InvitationsIndexRoute } from "./invitations.index";

interface RpcResponses {
  listMyPendingInvitations?: () => Response;
}

let responses: RpcResponses = {};

const server = setupServer(
  http.post("*/rpc/run", async ({ request }) => {
    const body = (await request.json()) as { action: string };

    if (body.action === "list_my_pending_invitations" && responses.listMyPendingInvitations) {
      return responses.listMyPendingInvitations();
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

const PENDING = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "rachel@example.test",
  characterName: "Mira Stoneheart",
  characterSummary: "Half-orc paladin.",
  status: "pending",
  expiresAt: "2026-05-27T12:00:00.000Z",
};

interface RenderOpts {
  isAuthenticated?: boolean;
}

function renderRoute({ isAuthenticated = true }: RenderOpts = {}) {
  const initialUser = isAuthenticated
    ? { id: "u1", email: "player@example.com" }
    : null;

  const rootRoute = createRootRouteWithContext<{ auth?: AuthContextValue }>()({
    component: () => <Outlet />,
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/invitations/",
    component: InvitationsIndexRoute,
  });

  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: () => <div data-testid="dashboard-stub">dashboard</div>,
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
    routeTree: rootRoute.addChildren([indexRoute, dashboardRoute, signInRoute]),
    history: createMemoryHistory({ initialEntries: ["/invitations/"] }),
    context: {
      auth: {
        user: initialUser,
        isAuthenticated,
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
        <AuthProvider initialState={{ user: initialUser }}>
          {children}
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  const rendered = render(<></>, { wrapper: Providers });
  return { router, ...rendered };
}

describe("/invitations route", () => {
  it("renders the empty state when there are no pending invitations", async () => {
    responses.listMyPendingInvitations = () =>
      HttpResponse.json({ success: true, data: [] });

    const { container } = renderRoute();

    expect(
      await screen.findByText(/You don't have any pending invitations/i),
    ).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it("renders each pending invitation in the list", async () => {
    responses.listMyPendingInvitations = () =>
      HttpResponse.json({ success: true, data: [PENDING] });

    const { container } = renderRoute();

    expect(await screen.findByTestId("my-pending-invitations-list")).toBeInTheDocument();
    expect(screen.getByTestId("my-pending-character-name")).toHaveTextContent(
      PENDING.characterName,
    );
    expect(screen.getByTestId("my-pending-character-summary")).toHaveTextContent(
      PENDING.characterSummary,
    );

    await expectNoAxeViolations(container);
  });
});

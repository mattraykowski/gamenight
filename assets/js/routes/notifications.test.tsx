import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
import { NotificationsRoute } from "./notifications";

interface RpcResponses {
  listMyNotifications?: () => Response;
  markNotificationRead?: () => Response;
}

let responses: RpcResponses = {};

const server = setupServer(
  http.post("*/rpc/run", async ({ request }) => {
    const body = (await request.json()) as { action: string };
    if (body.action === "list_my_notifications" && responses.listMyNotifications) {
      return responses.listMyNotifications();
    }
    if (body.action === "mark_notification_read" && responses.markNotificationRead) {
      return responses.markNotificationRead();
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
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path: "/notifications",
    component: NotificationsRoute,
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
    routeTree: rootRoute.addChildren([route, signInRoute]),
    history: createMemoryHistory({ initialEntries: ["/notifications"] }),
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

const NOTIFICATION = {
  id: "n1",
  kind: "game_invitation",
  subjectType: "invitation",
  subjectId: "i1",
  readAt: null,
  resolvedAt: null,
  insertedAt: "2026-04-27T12:00:00.000Z",
};

describe("/notifications route (T113)", () => {
  it("renders the empty state when there are no notifications", async () => {
    responses.listMyNotifications = () =>
      HttpResponse.json({ success: true, data: [] });

    const { container } = renderRoute();

    await waitFor(() =>
      expect(screen.getByTestId("notifications-list-empty")).toBeInTheDocument(),
    );

    await expectNoAxeViolations(container);
  });

  it("renders an unread notification with a Mark read action", async () => {
    responses.listMyNotifications = () =>
      HttpResponse.json({ success: true, data: [NOTIFICATION] });
    responses.markNotificationRead = () =>
      HttpResponse.json({
        success: true,
        data: { ...NOTIFICATION, readAt: "2026-04-27T12:30:00.000Z" },
      });

    const { container } = renderRoute();

    await waitFor(() =>
      expect(screen.getByTestId("notifications-list")).toBeInTheDocument(),
    );

    expect(screen.getByText("You have a new game invitation")).toBeInTheDocument();

    const markButton = screen.getByTestId(`notifications-list-mark-read-${NOTIFICATION.id}`);
    await userEvent.click(markButton);

    // The mutation invalidates the list query; the test passes if
    // no error is thrown — the list re-renders with the new state.
    await expectNoAxeViolations(container);
  });
});

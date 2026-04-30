import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
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
import { z } from "zod";

import { expectNoAxeViolations } from "@/test/a11y";
import { AuthProvider, type AuthContextValue } from "@/lib/auth/auth-context";
import { ToastProvider } from "@/features/toasts/toast-provider";
import type { RouterContext } from "@/routes/__root";
import { Route as CalendarFileRoute } from "./calendar";

interface CalendarRpcResponses {
  listSchedulesForCalendarMonth?: () => Response;
}

let calendarResponses: CalendarRpcResponses = {};

const server = setupServer(
  http.post("*/rpc/run", async ({ request }) => {
    const body = (await request.json()) as { action: string };
    if (body.action === "list_schedules_for_calendar_month") {
      if (calendarResponses.listSchedulesForCalendarMonth) {
        return calendarResponses.listSchedulesForCalendarMonth();
      }
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
  calendarResponses = {};
});

afterAll(() => {
  server.close();
  document.head.innerHTML = "";
});

const sampleEvent = (overrides: Record<string, unknown> = {}) => ({
  date: "2026-11-05",
  schedule_id: "sched-1",
  game_id: "game-1",
  game_title: "Curse of Strahd",
  time_slot_label: "7:00 PM – 11:00 PM",
  role: "gm",
  character_id: null,
  target_route: "/games/$gameId/schedules/$scheduleId",
  ...overrides,
});

// (kept for compatibility; the wire format is snake_case so we
// pass rows straight through without rewriting them.)

function renderCalendarAt(
  initialPath = "/calendar",
  options: { authenticated?: boolean } = { authenticated: true },
) {
  const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: () => <Outlet />,
  });

  const calendarRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/calendar",
    validateSearch: (
      search: Record<string, unknown>,
    ): { year?: number; month?: number } =>
      z
        .object({
          year: z.coerce.number().int().optional(),
          month: z.coerce.number().int().min(1).max(12).optional(),
        })
        .parse(search),
    beforeLoad: CalendarFileRoute.options.beforeLoad,
    component: CalendarFileRoute.options.component!,
  });

  const signInRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sign-in",
    component: () => <div data-testid="sign-in-page">sign-in</div>,
  });

  const elsewhereRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "$",
    component: () => <div data-testid="elsewhere">elsewhere</div>,
  });

  const auth: AuthContextValue = options.authenticated
    ? {
        user: { id: "u1", email: "player@example.com" },
        isAuthenticated: true,
        setUser: () => undefined,
        clearAuth: () => undefined,
      }
    : {
        user: null,
        isAuthenticated: false,
        setUser: () => undefined,
        clearAuth: () => undefined,
      };

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      calendarRoute,
      signInRoute,
      elsewhereRoute,
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: { auth, queryClient },
  });

  function Providers({ children }: { children: ReactNode }) {
    const initialState = options.authenticated
      ? { user: { id: "u1", email: "player@example.com" } }
      : { user: null };
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialState={initialState}>
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

describe("/calendar route (T011 / US1)", () => {
  it("redirects an anonymous visitor to /sign-in?redirect=/calendar", async () => {
    renderCalendarAt("/calendar", { authenticated: false });

    await waitFor(() => {
      expect(screen.getByTestId("sign-in-page")).toBeInTheDocument();
    });
  });

  it("renders the current-month grid with the empty-state helper when there are no events", async () => {
    const { container } = renderCalendarAt();

    await waitFor(
      () => {
        expect(screen.getByTestId("calendar-empty-helper")).toHaveTextContent(
          /no game days planned this month/i,
        );
      },
      { timeout: 5000 },
    );

    // Heading exists with the data-route-heading hook.
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveAttribute("data-route-heading");
    await expectNoAxeViolations(container);
  });

  it("renders an event pill when the RPC returns events", async () => {
    const event = sampleEvent({
      date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-15`,
      game_title: "Lost Mines",
    });
    calendarResponses.listSchedulesForCalendarMonth = () =>
      HttpResponse.json({ success: true, data: [event] });

    renderCalendarAt();

    await waitFor(() =>
      expect(screen.getByText(/lost mines/i)).toBeInTheDocument(),
    );
  });

  it("shows the Today button on a non-current month", async () => {
    renderCalendarAt("/calendar?year=2020&month=1");

    await waitFor(() =>
      expect(screen.getByTestId("calendar-today")).toBeInTheDocument(),
    );
  });

  it("hides the Today button on the current month", async () => {
    const now = new Date();
    renderCalendarAt(
      `/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
    );
    // Wait for the heading to render so the route has mounted.
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("calendar-today")).not.toBeInTheDocument();
  });

  it("clicking next-month advances the URL by one month", async () => {
    const user = userEvent.setup();
    renderCalendarAt("/calendar?year=2026&month=11");

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /november 2026/i }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("calendar-next-month"));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /december 2026/i }),
      ).toBeInTheDocument(),
    );
  });

  it("interactive controls have a 24×24 minimum target (WCAG 2.5.8) (T031)", async () => {
    renderCalendarAt("/calendar?year=2020&month=1");

    await waitFor(() =>
      expect(screen.getByTestId("calendar-prev-month")).toBeInTheDocument(),
    );

    // Each interactive nav button uses Tailwind `size="sm"` which is
    // 32 px tall — well above the 24×24 floor. Pin the class to keep
    // future redesigns from regressing target size.
    const prev = screen.getByTestId("calendar-prev-month");
    const next = screen.getByTestId("calendar-next-month");
    const today = screen.getByTestId("calendar-today");
    expect(prev.className).toMatch(/h-(8|9|10|11|12|14|16|20|24)/);
    expect(next.className).toMatch(/h-(8|9|10|11|12|14|16|20|24)/);
    expect(today.className).toMatch(/h-(8|9|10|11|12|14|16|20|24)/);
  });

  it("clicking next-month from December advances year + reads January", async () => {
    const user = userEvent.setup();
    renderCalendarAt("/calendar?year=2026&month=12");

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /december 2026/i }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("calendar-next-month"));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /january 2027/i }),
      ).toBeInTheDocument(),
    );
  });
});

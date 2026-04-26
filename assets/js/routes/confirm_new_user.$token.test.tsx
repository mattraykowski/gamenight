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
import { ConfirmNewUserRoute } from "./confirm_new_user.$token";

type ConfirmHandler = (request: Request) => Promise<Response> | Response;

let latestHandler: ConfirmHandler = () =>
  HttpResponse.json({ user: { id: "u1", email: "new@example.com" } });

const server = setupServer(
  http.post("*/auth/user/confirm_new_user", ({ request }) => latestHandler(request)),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
});

beforeEach(() => {
  latestHandler = () =>
    HttpResponse.json({ user: { id: "u1", email: "new@example.com" } });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  document.head.innerHTML = "";
});

// A small JWT payload with an `email` claim so `emailFromToken` can
// pull the banner text out in the "shows banner" test.
function makeJwt(payload: Record<string, unknown>): string {
  const encodeSegment = (data: unknown) =>
    btoa(JSON.stringify(data))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return [encodeSegment({ alg: "HS256", typ: "JWT" }), encodeSegment(payload), "sig"].join(".");
}

function renderConfirm(token: string) {
  const rootRoute = createRootRouteWithContext<{ auth?: AuthContextValue }>()({
    component: () => <Outlet />,
  });
  const confirmRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/confirm_new_user/$token",
    component: ConfirmNewUserRoute,
  });
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    validateSearch: (search: Record<string, unknown>): { toast?: string } => ({
      toast: typeof search.toast === "string" ? search.toast : undefined,
    }),
    component: () => <div data-testid="dashboard">dashboard</div>,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([confirmRoute, dashboardRoute]),
    history: createMemoryHistory({ initialEntries: [`/confirm_new_user/${token}`] }),
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
        <AuthProvider initialState={{ user: null }}>
          {children}
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  const rendered = render(<></>, { wrapper: Providers });
  return { router, ...rendered };
}

describe("/confirm_new_user/$token route", () => {
  it("shows the decoded email in the informational banner", async () => {
    const token = makeJwt({ email: "new-user@example.com" });
    const { container } = renderConfirm(token);

    await waitFor(() =>
      expect(screen.getByTestId("confirm-banner")).toHaveTextContent(
        /new-user@example\.com/,
      ),
    );

    await expectNoAxeViolations(container);
  });

  it("falls back to a generic message when the token cannot be decoded", async () => {
    const { container } = renderConfirm("not-a-jwt");

    await waitFor(() =>
      expect(screen.getByText(/confirming your email address/i)).toBeInTheDocument(),
    );

    await expectNoAxeViolations(container);
  });

  it("navigates to /dashboard?toast=email_confirmed on successful confirmation", async () => {
    const token = makeJwt({ email: "new-user@example.com" });
    const { router } = renderConfirm(token);

    await waitFor(() => screen.getByRole("button", { name: /confirm email address/i }));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /confirm email address/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/dashboard");
    });
    expect(router.state.location.search).toMatchObject({ toast: "email_confirmed" });
  });

  it("renders the invalid-link view when the POST returns an error", async () => {
    latestHandler = () =>
      HttpResponse.json(
        {
          errors: [
            {
              field: null,
              message: "The token is invalid",
              code: "invalid_token",
            },
          ],
        },
        { status: 422 },
      );

    const token = makeJwt({ email: "new-user@example.com" });
    renderConfirm(token);
    await waitFor(() => screen.getByRole("button", { name: /confirm email address/i }));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /confirm email address/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /confirmation link is invalid/i }),
      ).toBeInTheDocument(),
    );
  });
});

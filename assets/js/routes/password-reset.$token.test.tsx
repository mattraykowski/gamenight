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
import { PasswordResetRoute } from "./password-reset.$token";

type ResetHandler = (request: Request) => Promise<Response> | Response;

let latestHandler: ResetHandler = () =>
  HttpResponse.json({ user: { id: "u1", email: "player@example.com" } });

const server = setupServer(
  http.post("*/auth/user/password/reset", ({ request }) => latestHandler(request)),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
});

beforeEach(() => {
  latestHandler = () =>
    HttpResponse.json({ user: { id: "u1", email: "player@example.com" } });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  document.head.innerHTML = "";
});

function renderPasswordReset(token = "reset-token-abc") {
  const rootRoute = createRootRouteWithContext<{ auth?: AuthContextValue }>()({
    component: () => <Outlet />,
  });
  const resetRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/password-reset/$token",
    component: PasswordResetRoute,
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
    routeTree: rootRoute.addChildren([resetRoute, dashboardRoute]),
    history: createMemoryHistory({ initialEntries: [`/password-reset/${token}`] }),
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

describe("/password-reset/$token route", () => {
  it("renders the new-password form with no axe violations", async () => {
    const { container } = renderPasswordReset();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /choose a new password/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it("shows a validation error when passwords do not match", async () => {
    renderPasswordReset();
    await waitFor(() => screen.getByRole("button", { name: /reset password/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^new password$/i), "password1");
    await user.type(screen.getByLabelText(/confirm new password/i), "password2");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() =>
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument(),
    );
  });

  it("navigates to /dashboard?toast=password_reset on success", async () => {
    const { router } = renderPasswordReset();
    await waitFor(() => screen.getByRole("button", { name: /reset password/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^new password$/i), "correct-horse");
    await user.type(screen.getByLabelText(/confirm new password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/dashboard");
    });
    expect(router.state.location.search).toMatchObject({ toast: "password_reset" });
  });

  it("surfaces an expired-token response with a request-new-link CTA", async () => {
    latestHandler = () =>
      HttpResponse.json(
        {
          errors: [
            {
              field: "reset_token",
              message: "The reset token is invalid or has expired",
              code: "invalid_token",
            },
          ],
        },
        { status: 422 },
      );

    renderPasswordReset();
    await waitFor(() => screen.getByRole("button", { name: /reset password/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^new password$/i), "correct-horse");
    await user.type(screen.getByLabelText(/confirm new password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /reset password/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/reset token is invalid or has expired/i);
    expect(alert.querySelector("a")).toHaveAttribute("href", "/reset");
  });
});

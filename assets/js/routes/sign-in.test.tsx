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
import type { AuthUser } from "@/lib/auth/auth-state";
import { SignInRoute } from "./sign-in";

type SignInHandler = (request: Request) => Promise<Response> | Response;

let latestHandler: SignInHandler = () =>
  HttpResponse.json({ user: { id: "u1", email: "player@example.com" } });

const server = setupServer(
  http.post("*/auth/user/password/sign_in", ({ request }) => latestHandler(request)),
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

/**
 * Stands up a minimum TanStack Router harness so the SignInRoute can
 * read its typed search params and call `useNavigate`. We assemble a
 * tiny route tree on the fly (root + `/sign-in` + `/dashboard`) against
 * a memory history so assertions can inspect `router.state.location.pathname`
 * after a successful submission.
 */
function buildRouter(initialPath: string) {
  const rootRoute = createRootRouteWithContext<{ auth?: AuthContextValue }>()({
    component: () => <Outlet />,
  });
  const signInRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sign-in",
    validateSearch: (
      search: Record<string, unknown>,
    ): { redirect?: string; error?: string; email?: string } => ({
      redirect: typeof search.redirect === "string" ? search.redirect : undefined,
      error: typeof search.error === "string" ? search.error : undefined,
      email: typeof search.email === "string" ? search.email : undefined,
    }),
    component: SignInRoute,
  });
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: () => <div data-testid="dashboard">dashboard</div>,
  });
  const catchAllRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "$",
    component: () => <div data-testid="elsewhere">elsewhere</div>,
  });

  return createRouter({
    routeTree: rootRoute.addChildren([signInRoute, dashboardRoute, catchAllRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: { auth: undefined },
  });
}

function renderSignInAt(initialPath = "/sign-in", initialAuth: AuthUser | null = null) {
  const router = buildRouter(initialPath);

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
        <AuthProvider initialState={{ user: initialAuth }}>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }

  const rendered = render(<RouterProvider router={router} />, { wrapper: Providers });
  return { router, ...rendered };
}

describe("/sign-in route", () => {
  it("renders the sign-in form with email, password, and remember-me", async () => {
    const { container } = renderSignInAt();

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: /sign in/i })).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/keep me signed in/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();

    const heading = screen.getByRole("heading", { level: 1, name: /sign in/i });
    expect(heading).toHaveAttribute("data-route-heading");
    expect(heading).toHaveAttribute("tabIndex", "-1");

    await expectNoAxeViolations(container);
  });

  it("shows the generic 'try again' banner when ?error=generic is present", async () => {
    renderSignInAt("/sign-in?error=generic");

    await waitFor(() =>
      expect(
        screen.getByText(/something went wrong\. please try signing in again/i),
      ).toBeInTheDocument(),
    );
  });

  it("maps 401 responses onto an inline form-level error", async () => {
    latestHandler = () =>
      HttpResponse.json(
        {
          errors: [
            {
              field: null,
              message: "Incorrect email or password",
              code: "invalid_credentials",
            },
          ],
        },
        { status: 401 },
      );

    renderSignInAt();
    await waitFor(() => screen.getByRole("button", { name: /sign in/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "wrong@example.com");
    await user.type(screen.getByLabelText(/password/i), "bad");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/incorrect email or password/i),
    );
  });

  it("surfaces a 429 rate-limit response as the inline banner", async () => {
    latestHandler = () =>
      HttpResponse.json(
        {
          errors: [
            {
              field: null,
              message: "Too many attempts. Try again in 42s.",
              code: "rate_limited",
            },
          ],
        },
        { status: 429, headers: { "retry-after": "42" } },
      );

    renderSignInAt();
    await waitFor(() => screen.getByRole("button", { name: /sign in/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "spammer@example.com");
    await user.type(screen.getByLabelText(/password/i), "whatever");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/too many attempts/i),
    );
  });

  it("redirects to /dashboard on successful sign-in", async () => {
    const { router } = renderSignInAt();
    await waitFor(() => screen.getByRole("button", { name: /sign in/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "player@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/dashboard");
    });
  });

  it("honours the `?redirect=` target when safe", async () => {
    const { router } = renderSignInAt("/sign-in?redirect=%2Fgames%2F42");
    await waitFor(() => screen.getByRole("button", { name: /sign in/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "player@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Memory router will land on /games/42 if the redirect was applied;
    // a catch-all route handles the pathname assertion.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/games/42");
    });
  });

  it("falls back to /dashboard for unsafe redirect targets", async () => {
    const { router } = renderSignInAt("/sign-in?redirect=%2F%2Fevil.com");
    await waitFor(() => screen.getByRole("button", { name: /sign in/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "player@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/dashboard");
    });
  });
});

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
import { RegisterRoute } from "./register";

type RegisterHandler = (request: Request) => Promise<Response> | Response;

let latestHandler: RegisterHandler = () =>
  HttpResponse.json({ user: { id: "u1", email: "new@example.com" } });

const server = setupServer(
  http.post("*/auth/user/password/register", ({ request }) => latestHandler(request)),
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

function renderRegister() {
  const rootRoute = createRootRouteWithContext<{ auth?: AuthContextValue }>()({
    component: () => <Outlet />,
  });
  const registerRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/register",
    validateSearch: (
      search: Record<string, unknown>,
    ): { redirect?: string } => ({
      redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    }),
    component: RegisterRoute,
  });
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: () => <div data-testid="dashboard">dashboard</div>,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([registerRoute, dashboardRoute]),
    history: createMemoryHistory({ initialEntries: ["/register"] }),
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

describe("/register route", () => {
  it("renders the register form and has no axe violations", async () => {
    const { container } = renderRegister();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /create your account/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it("shows a validation error when passwords do not match", async () => {
    renderRegister();
    await waitFor(() => screen.getByRole("button", { name: /create account/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password1");
    await user.type(screen.getByLabelText(/confirm password/i), "password2");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument(),
    );
  });

  it("shows the 'already registered' link-back UI for taken emails", async () => {
    latestHandler = () =>
      HttpResponse.json(
        {
          errors: [
            {
              field: "email",
              message: "has already been taken",
              code: "taken",
            },
          ],
        },
        { status: 422 },
      );

    renderRegister();
    await waitFor(() => screen.getByRole("button", { name: /create account/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "existing@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "password1");
    await user.type(screen.getByLabelText(/confirm password/i), "password1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    const takenMessage = await screen.findByText(/that email is already registered/i);
    const takenContainer = takenMessage.closest("p") as HTMLElement;
    expect(takenContainer).not.toBeNull();

    const signInLink = within(takenContainer).getByRole("link", { name: /^sign in$/i });
    expect(signInLink).toHaveAttribute(
      "href",
      "/sign-in?email=existing%40example.com",
    );
    const resetLink = within(takenContainer).getByRole("link", {
      name: /reset your password/i,
    });
    expect(resetLink).toHaveAttribute(
      "href",
      "/reset?email=existing%40example.com",
    );
  });

  it("redirects to /dashboard on successful registration", async () => {
    const { router } = renderRegister();
    await waitFor(() => screen.getByRole("button", { name: /create account/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "correct-horse");
    await user.type(screen.getByLabelText(/confirm password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/dashboard");
    });
  });
});

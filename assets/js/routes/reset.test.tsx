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
import { ResetRequestRoute } from "./reset";

type ResetRequestHandler = (request: Request) => Promise<Response> | Response;

let latestHandler: ResetRequestHandler = () => new HttpResponse(null, { status: 200 });

const server = setupServer(
  http.post("*/auth/user/password/reset_request", ({ request }) => latestHandler(request)),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
});

beforeEach(() => {
  latestHandler = () => new HttpResponse(null, { status: 200 });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  document.head.innerHTML = "";
});

function renderReset(initialPath = "/reset") {
  const rootRoute = createRootRouteWithContext<{ auth?: AuthContextValue }>()({
    component: () => <Outlet />,
  });
  const resetRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/reset",
    validateSearch: (
      search: Record<string, unknown>,
    ): { email?: string } => ({
      email: typeof search.email === "string" ? search.email : undefined,
    }),
    component: ResetRequestRoute,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([resetRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
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

  return render(<></>, { wrapper: Providers });
}

describe("/reset route", () => {
  it("renders the reset-request form with no axe violations", async () => {
    const { container } = renderReset();

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /reset your password/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it("shows the ambiguous confirmation on successful submission", async () => {
    renderReset();
    await waitFor(() => screen.getByRole("button", { name: /send reset link/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "whoever@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /check your email/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/if that email has an account/i)).toBeInTheDocument();
  });

  it("shows the ambiguous confirmation even when the backend errored", async () => {
    latestHandler = () => new HttpResponse(null, { status: 500 });

    renderReset();
    await waitFor(() => screen.getByRole("button", { name: /send reset link/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "errors@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /check your email/i }),
      ).toBeInTheDocument(),
    );
  });

  it("surfaces a 429 rate-limit response inline without switching to success", async () => {
    latestHandler = () =>
      HttpResponse.json(
        {
          errors: [
            {
              field: null,
              message: "Too many attempts. Try again in 60s.",
              code: "rate_limited",
            },
          ],
        },
        { status: 429 },
      );

    renderReset();
    await waitFor(() => screen.getByRole("button", { name: /send reset link/i }));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), "ratelimited@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/too many attempts/i),
    );
    expect(
      screen.queryByRole("heading", { level: 1, name: /check your email/i }),
    ).not.toBeInTheDocument();
  });

  it("pre-fills the email from ?email= (register link-back entry point)", async () => {
    renderReset("/reset?email=pre-fill%40example.com");
    await waitFor(() => screen.getByRole("button", { name: /send reset link/i }));

    expect(screen.getByLabelText(/email/i)).toHaveValue("pre-fill@example.com");
  });
});

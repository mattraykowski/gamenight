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
import { MagicLinkLandingRoute } from "./magic_link.$token";

type SignInHandler = (request: Request) => Promise<Response> | Response;

let latestHandler: SignInHandler = () =>
  HttpResponse.json({ user: { id: "u1", email: "new-user@example.com" } });

const server = setupServer(
  http.post("*/auth/user/magic_link", ({ request }) => latestHandler(request)),
);

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf" />';
});

beforeEach(() => {
  latestHandler = () =>
    HttpResponse.json({ user: { id: "u1", email: "new-user@example.com" } });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  document.head.innerHTML = "";
});

function makeJwt(payload: Record<string, unknown>): string {
  const encodeSegment = (data: unknown) =>
    btoa(JSON.stringify(data))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return [encodeSegment({ alg: "HS256", typ: "JWT" }), encodeSegment(payload), "sig"].join(".");
}

function renderMagicLink(token: string, initialAuth: AuthUser | null = null) {
  const rootRoute = createRootRouteWithContext<{ auth?: AuthContextValue }>()({
    component: () => <Outlet />,
  });
  const magicLinkRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/magic_link/$token",
    component: MagicLinkLandingRoute,
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
    routeTree: rootRoute.addChildren([magicLinkRoute, dashboardRoute]),
    history: createMemoryHistory({ initialEntries: [`/magic_link/${token}`] }),
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
        <AuthProvider initialState={{ user: initialAuth }}>
          {children}
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  const rendered = render(<></>, { wrapper: Providers });
  return { router, ...rendered };
}

describe("/magic_link/$token route", () => {
  it("shows the decoded email in the informational banner", async () => {
    const token = makeJwt({ email: "new-user@example.com" });
    const { container } = renderMagicLink(token);

    await waitFor(() =>
      expect(screen.getByTestId("magic-link-banner")).toHaveTextContent(
        /new-user@example\.com/,
      ),
    );
    await expectNoAxeViolations(container);
  });

  it("warns when the signed-in user differs from the token's email", async () => {
    const token = makeJwt({ email: "new@example.com" });
    renderMagicLink(token, { id: "u1", email: "existing@example.com" });

    await waitFor(() => screen.getByTestId("account-switch-banner"));
    expect(screen.getByTestId("account-switch-banner")).toHaveTextContent(
      /existing@example\.com/,
    );
  });

  it("navigates to /dashboard?toast=signed_in on success", async () => {
    const token = makeJwt({ email: "new-user@example.com" });
    const { router } = renderMagicLink(token);

    await waitFor(() => screen.getByRole("button", { name: /sign in to game night/i }));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /sign in to game night/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/dashboard");
    });
    expect(router.state.location.search).toMatchObject({ toast: "signed_in" });
  });

  it("renders the invalid-link view on token errors", async () => {
    latestHandler = () =>
      HttpResponse.json(
        {
          errors: [
            {
              field: null,
              message: "The token is invalid or has expired",
              code: "invalid_token",
            },
          ],
        },
        { status: 422 },
      );

    const token = makeJwt({ email: "new-user@example.com" });
    renderMagicLink(token);
    await waitFor(() => screen.getByRole("button", { name: /sign in to game night/i }));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /sign in to game night/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: /sign-in link is invalid/i }),
      ).toBeInTheDocument(),
    );
  });
});

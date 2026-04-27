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
import { ToastProvider } from "@/features/toasts/toast-provider";
import { InvitationsTokenRoute } from "./invitations.$token";

interface RpcResponses {
  previewInvitation?: () => Response;
  acceptInvitation?: () => Response;
  declineInvitation?: () => Response;
}

let responses: RpcResponses = {};

const server = setupServer(
  http.post("*/rpc/run", async ({ request }) => {
    const body = (await request.json()) as { action: string };

    if (body.action === "preview_invitation" && responses.previewInvitation) {
      return responses.previewInvitation();
    }

    if (body.action === "accept_invitation" && responses.acceptInvitation) {
      return responses.acceptInvitation();
    }

    if (body.action === "decline_invitation" && responses.declineInvitation) {
      return responses.declineInvitation();
    }

    return HttpResponse.json(
      {
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
      },
      { status: 200 },
    );
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

const VALID_PREVIEW = {
  id: "11111111-1111-1111-1111-111111111111",
  gameTitle: "Curse of Strahd",
  inviterEmail: "matt@example.com",
  characterName: "Mira Stoneheart",
  expiresAt: "2026-05-27T12:00:00.000Z",
};

function previewSuccess() {
  return HttpResponse.json({ success: true, data: VALID_PREVIEW });
}

function previewInvalidToken() {
  return HttpResponse.json({
    success: false,
    errors: [
      {
        type: "invalid_argument",
        message: "invalid_token",
        shortMessage: "invalid_token",
        vars: {},
        fields: ["token"],
        path: [],
      },
    ],
  });
}

function acceptSuccess() {
  return HttpResponse.json({
    success: true,
    data: {
      id: VALID_PREVIEW.id,
      status: "accepted",
      acceptedPlayerId: "22222222-2222-2222-2222-222222222222",
    },
  });
}

function declineSuccess() {
  return HttpResponse.json({
    success: true,
    data: {
      id: VALID_PREVIEW.id,
      status: "declined",
    },
  });
}

interface RenderOpts {
  isAuthenticated?: boolean;
}

function renderRoute({ isAuthenticated = false }: RenderOpts = {}) {
  const initialUser = isAuthenticated
    ? { id: "u1", email: "player@example.com" }
    : null;

  const rootRoute = createRootRouteWithContext<{ auth?: AuthContextValue }>()({
    component: () => <Outlet />,
  });

  const invitationsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/invitations/$token",
    validateSearch: (): Record<string, never> => ({}),
    component: InvitationsTokenRoute,
  });

  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    component: () => <div data-testid="dashboard-stub">dashboard</div>,
  });

  const registerRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/register",
    validateSearch: (
      search: Record<string, unknown>,
    ): { redirect?: string } => ({
      redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    }),
    component: () => <div data-testid="register-stub">register</div>,
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
    routeTree: rootRoute.addChildren([
      invitationsRoute,
      dashboardRoute,
      registerRoute,
      signInRoute,
    ]),
    history: createMemoryHistory({
      initialEntries: ["/invitations/sample.token.string"],
    }),
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
        <AuthProvider initialState={{ user: initialUser }}>
          <ToastProvider>
            {children}
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  const rendered = render(<></>, { wrapper: Providers });
  return { router, ...rendered };
}

describe("/invitations/$token route", () => {
  it("renders the preview + register/sign-in CTAs for an anonymous viewer", async () => {
    responses.previewInvitation = previewSuccess;

    const { container } = renderRoute({ isAuthenticated: false });

    expect(
      await screen.findByRole("heading", { level: 1, name: /You've been invited/i }),
    ).toBeInTheDocument();

    expect(await screen.findByText(VALID_PREVIEW.gameTitle)).toBeInTheDocument();
    expect(screen.getByTestId("invitation-character-name")).toHaveTextContent(
      VALID_PREVIEW.characterName,
    );
    expect(screen.getByTestId("invitation-inviter-email")).toHaveTextContent(
      VALID_PREVIEW.inviterEmail,
    );

    // Anonymous CTAs carry the invitation URL through ?redirect=
    const registerCta = screen.getByTestId("invitation-register-cta");
    expect(registerCta).toHaveAttribute(
      "href",
      "/register?redirect=%2Finvitations%2Fsample.token.string",
    );
    const signInCta = screen.getByTestId("invitation-signin-cta");
    expect(signInCta).toHaveAttribute(
      "href",
      "/sign-in?redirect=%2Finvitations%2Fsample.token.string",
    );

    // No Accept button surfaced to anonymous viewers.
    expect(screen.queryByTestId("invitation-accept-button")).not.toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it("renders the Accept button and accepts when clicked", async () => {
    responses.previewInvitation = previewSuccess;
    responses.acceptInvitation = acceptSuccess;

    const { router } = renderRoute({ isAuthenticated: true });

    const acceptButton = await screen.findByTestId("invitation-accept-button");
    await userEvent.click(acceptButton);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/dashboard");
    });
  });

  it("renders the Decline trigger and declines after confirm (T091/T095)", async () => {
    responses.previewInvitation = previewSuccess;
    responses.declineInvitation = declineSuccess;

    const { router } = renderRoute({ isAuthenticated: true });

    const trigger = await screen.findByTestId("invitation-decline-trigger");
    await userEvent.click(trigger);

    // Modal opens with the confirm button — click it.
    const confirm = await screen.findByTestId("decline-invitation-confirm");
    await userEvent.click(confirm);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/dashboard");
    });
  });

  it("does not render the Decline trigger for anonymous viewers", async () => {
    responses.previewInvitation = previewSuccess;

    renderRoute({ isAuthenticated: false });

    // Anonymous viewers see the Register / Sign-in CTAs only — no
    // decline trigger because the action requires an actor.
    await screen.findByTestId("invitation-register-cta");
    expect(screen.queryByTestId("invitation-decline-trigger")).not.toBeInTheDocument();
  });

  it("renders the friendly invalid-token state when preview fails", async () => {
    responses.previewInvitation = previewInvalidToken;

    const { container } = renderRoute({ isAuthenticated: false });

    expect(
      await screen.findByText(/This invitation link is no longer valid/i),
    ).toBeInTheDocument();

    expect(screen.queryByTestId("accept-invitation-card")).not.toBeInTheDocument();

    await expectNoAxeViolations(container);
  });
});

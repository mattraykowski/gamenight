import { StrictMode, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../css/app.css";
import { routeTree } from "./routeTree.gen";
import { AuthProvider, useAuth } from "@/lib/auth/auth-context";
import { createAuthedFetch } from "@/lib/auth/authed-fetch";
import { configureApiClient } from "@/lib/api/client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient, auth: undefined },
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

/**
 * Installs the 401 interceptor on top of the global `fetch` and
 * surfaces router/auth handles to the module-level `getClientOptions`
 * used by `createResourceHooks`. Lives inside `<AuthProvider>` so it
 * can read live auth state; the router is the module-scoped singleton
 * created above, so we don't need to be inside a `<RouterProvider>`.
 */
function AuthInterceptor() {
  const auth = useAuth();

  useEffect(() => {
    const authedFetch = createAuthedFetch({
      onAuthFailed: ({ currentPath }) => {
        auth.clearAuth();
        // `/sign-in` is served by Phoenix; force a full-document
        // navigation via `href` so the cookie-based session flow picks
        // up from there.
        router.navigate({
          href: `/sign-in?redirect=${encodeURIComponent(currentPath)}`,
        });
      },
    });
    configureApiClient({ customFetch: authedFetch });
    return () => configureApiClient({ customFetch: undefined });
  }, [auth]);

  return null;
}

function AppRouter() {
  const auth = useAuth();
  const context = useMemo(() => ({ queryClient, auth }), [auth]);
  return (
    <>
      <AuthInterceptor />
      <RouterProvider router={router} context={context} />
    </>
  );
}

const rootEl = document.getElementById("app");
if (rootEl && !rootEl.innerHTML) {
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

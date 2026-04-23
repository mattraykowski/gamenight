import { StrictMode, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../css/app.css";
import { routeTree } from "./routeTree.gen";
import { AuthProvider, useAuth } from "@/lib/auth/auth-context";
import { createAuthedFetch } from "@/lib/auth/authed-fetch";
import { configureApiClient } from "@/lib/api/client";
import { installReporter } from "@/features/vitals/reporter";
import { ToastProvider } from "@/features/toasts/toast-provider";

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
        router.navigate({
          to: "/sign-in",
          search: { redirect: currentPath },
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
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  );

  // Web-vitals reporter. `import.meta.env.VITE_VITALS_SAMPLE_RATE`
  // overrides per-environment; defaults favour full visibility in dev
  // and a 10% sample in production to keep ingestion cost bounded.
  // Failures are swallowed by the reporter itself (`onError`) so a
  // broken endpoint never crashes the app.
  const sampleRate = resolveSampleRate();
  if (sampleRate > 0) {
    void installReporter({ sampleRate });
  }
}

function resolveSampleRate(): number {
  const override = import.meta.env.VITE_VITALS_SAMPLE_RATE;
  if (typeof override === "string" && override.length > 0) {
    const parsed = Number(override);
    if (Number.isFinite(parsed)) return parsed;
  }
  return import.meta.env.DEV ? 1 : 0.1;
}

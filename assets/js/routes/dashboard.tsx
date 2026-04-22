import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCurrentUser } from "@/features/current-user/hooks";
import { useAuth } from "@/lib/auth/auth-context";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      // `/sign-in` is served by Phoenix (ash_authentication_phoenix), not
      // by the SPA router, so use `href` to trigger a full-document
      // navigation instead of a typed internal route.
      throw redirect({
        href: `/sign-in?redirect=${encodeURIComponent(location.href)}`,
      });
    }
  },
  component: DashboardRoute,
});

/**
 * Exported so unit tests can render the component without going through
 * TanStack Router's lazy/suspense wrapping (which `autoCodeSplitting`
 * applies to `Route.options.component`).
 */
export function DashboardRoute() {
  const auth = useAuth();
  const { data, isPending, isError, error } = useCurrentUser();

  const displayName = data?.email ?? auth.user?.email ?? "";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1
        data-route-heading
        tabIndex={-1}
        className="text-4xl font-bold tracking-tight"
      >
        Dashboard
      </h1>
      {isPending ? (
        <p className="mt-4 text-muted-foreground" aria-live="polite">
          Loading your account…
        </p>
      ) : isError ? (
        <p className="mt-4 text-destructive" role="alert">
          We couldn&apos;t load your account ({error.kind}).
        </p>
      ) : (
        <p className="mt-4 text-lg text-muted-foreground">
          Welcome, <span data-testid="current-user-email">{displayName}</span>.
        </p>
      )}
    </main>
  );
}

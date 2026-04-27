import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { useCurrentUser } from "@/features/current-user/hooks";
import { useAuth } from "@/lib/auth/auth-context";
import { MyGamesColumn } from "@/features/games/components/my-games-column";
import { MyCharactersColumn } from "@/features/players/components/my-characters-column";
import { useConsumeToastParam } from "@/features/toasts/toast-provider";

const dashboardSearchSchema = z.object({
  toast: z.string().optional(),
});

export const Route = createFileRoute("/dashboard")({
  validateSearch: dashboardSearchSchema,
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
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
  const search = Route.useSearch();
  const { data, isPending, isError, error } = useCurrentUser();

  useConsumeToastParam(search.toast);

  const displayName = data?.email ?? auth.user?.email ?? "";

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1
          data-route-heading
          tabIndex={-1}
          className="text-4xl font-bold tracking-tight"
        >
          Dashboard
        </h1>
      </div>
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

      <div
        className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2"
        data-testid="dashboard-columns"
      >
        <MyCharactersColumn />
        <MyGamesColumn />
      </div>
    </main>
  );
}

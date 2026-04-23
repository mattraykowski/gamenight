import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useCurrentUser } from "@/features/current-user/hooks";
import { useAuth } from "@/lib/auth/auth-context";
import { useSignOut } from "@/features/auth/hooks";
import { useListMineActive } from "@/features/games/hooks";
import { GamesTable } from "@/features/games/components/games-table";
import { GamesEmptyState } from "@/features/games/components/empty-state";
import { useConsumeToastParam } from "@/features/toasts/toast-provider";
import { Button } from "@/components/ui/button";

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
  const navigate = useNavigate();
  const signOut = useSignOut();
  const { data, isPending, isError, error } = useCurrentUser();
  const activeGames = useListMineActive();

  useConsumeToastParam(search.toast);

  const displayName = data?.email ?? auth.user?.email ?? "";

  async function onSignOut() {
    try {
      await signOut.mutateAsync();
      await navigate({ to: "/" });
    } catch {
      // Swallow — clearAuth already ran only on success, so the UI
      // remains authenticated and the user can retry. Error rendering
      // is deferred until we add a shared toast surface.
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1
          data-route-heading
          tabIndex={-1}
          className="text-4xl font-bold tracking-tight"
        >
          Dashboard
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={onSignOut}
          disabled={signOut.isPending}
          data-testid="sign-out-button"
        >
          {signOut.isPending ? "Signing out…" : "Sign out"}
        </Button>
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

      <section className="mt-12" aria-labelledby="my-active-games-heading">
        <header className="flex items-end justify-between gap-4">
          <h2 id="my-active-games-heading" className="text-2xl font-semibold tracking-tight">
            My Active Games
          </h2>
          <div className="flex items-center gap-3">
            <a
              href="/games"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              data-testid="dashboard-view-all-games"
            >
              View All Games
            </a>
            <Button asChild size="sm" data-testid="dashboard-create-game">
              <Link to="/games/new">Create new game</Link>
            </Button>
          </div>
        </header>

        <div className="mt-6">
          {activeGames.isPending ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading your games…
            </p>
          ) : activeGames.isError ? (
            <p className="text-sm text-destructive" role="alert">
              We couldn&apos;t load your games ({activeGames.error.kind}). Please refresh.
            </p>
          ) : activeGames.data.length > 0 ? (
            <GamesTable games={activeGames.data} />
          ) : (
            <GamesEmptyState kind="no_games_at_all" />
          )}
        </div>
      </section>
    </main>
  );
}

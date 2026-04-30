import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GamesTable } from "@/features/games/components/games-table";
import { GamesEmptyState } from "@/features/games/components/empty-state";
import { useListMine } from "@/features/games/hooks";

export const Route = createFileRoute("/games/")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }
  },
  component: AllGamesRoute,
});

export function AllGamesRoute() {
  const all = useListMine();

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1
          data-route-heading
          tabIndex={-1}
          className="font-serif text-4xl font-bold tracking-tight"
        >
          All Games
        </h1>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard" search={{}}>
              Dashboard
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/games/new">Create new game</Link>
          </Button>
        </div>
      </div>

      <div className="mt-8">
        {all.isPending ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading your games…
          </p>
        ) : all.isError ? (
          <p className="text-sm text-destructive" role="alert">
            We couldn&apos;t load your games ({all.error.kind}). Please refresh.
          </p>
        ) : all.data.length > 0 ? (
          <GamesTable games={all.data} showStatus />
        ) : (
          <GamesEmptyState kind="no_games_at_all" />
        )}
      </div>
    </main>
  );
}

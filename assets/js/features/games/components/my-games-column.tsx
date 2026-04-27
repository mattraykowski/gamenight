import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useListMine, useListMineActive } from "../hooks";
import { GamesTable } from "./games-table";
import { GamesEmptyState } from "./empty-state";

/**
 * Dashboard right-column "My Games" section. Lists the actor's
 * Active games (status: :active) — same filter as the previous
 * standalone "My Active Games" section, just packaged as a
 * column-shaped component to sit alongside `<MyCharactersColumn />`
 * on the redesigned two-column dashboard (FR-027).
 *
 * The discriminated empty state is preserved from the prior
 * implementation:
 *   - `no_games_at_all` — actor has zero games.
 *   - `no_active_games` — actor has games, but none are Active.
 *   - populated table otherwise.
 */
export function MyGamesColumn() {
  const activeGames = useListMineActive();
  // Only fetch the full list when the active list is empty — drives
  // the discriminated empty-state.
  const shouldCheckAll = activeGames.isSuccess && activeGames.data.length === 0;
  const allGames = useListMine();
  const totalCount = shouldCheckAll && allGames.isSuccess ? allGames.data.length : 0;

  return (
    <section aria-labelledby="my-games-heading">
      <header className="flex items-end justify-between gap-4">
        <h2 id="my-games-heading" className="text-2xl font-semibold tracking-tight">
          My Games
        </h2>
        <div className="flex items-center gap-3">
          <Link
            to="/games"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            data-testid="dashboard-view-all-games"
          >
            View All Games
          </Link>
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
        ) : totalCount > 0 ? (
          <GamesEmptyState kind="no_active_games" totalCount={totalCount} />
        ) : (
          <GamesEmptyState kind="no_games_at_all" />
        )}
      </div>
    </section>
  );
}

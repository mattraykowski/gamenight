import { Link } from "@tanstack/react-router";
import { useListMyCharacters } from "../hooks";
import { CharacterCard } from "./character-card";
import { CharactersEmptyState } from "./characters-empty-state";

/**
 * Dashboard left-column "My Characters" section. Filters the
 * actor's Player rows to `active` + `inactive` per FR-029 — `done`
 * characters are hidden from the dashboard but remain reachable via
 * the "View all" link to `/characters` (which lists every status).
 *
 * Card rendering is delegated to <CharacterCard /> so the dashboard
 * and the View All page stay visually consistent.
 */
export function MyCharactersColumn() {
  const characters = useListMyCharacters();

  const dashboardRoster =
    characters.data?.filter((player) => player.status !== "done") ?? [];

  return (
    <section aria-labelledby="my-characters-heading">
      <header className="flex items-end justify-between gap-4">
        <h2 id="my-characters-heading" className="text-2xl font-semibold tracking-tight">
          My Characters
        </h2>
        <Link
          to="/characters"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          data-testid="dashboard-view-all-characters"
        >
          View all
        </Link>
      </header>

      <div className="mt-6">
        {characters.isPending ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading your characters…
          </p>
        ) : characters.isError ? (
          <p className="text-sm text-destructive" role="alert">
            We couldn&apos;t load your characters. Please refresh.
          </p>
        ) : dashboardRoster.length === 0 ? (
          <CharactersEmptyState />
        ) : (
          <ul
            className="divide-y rounded-md border"
            data-testid="my-characters-list"
          >
            {dashboardRoster.map((player) => (
              <CharacterCard
                key={player.id}
                player={player}
                testIdPrefix="my-characters-row"
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

import { Link } from "@tanstack/react-router";
import { useListMyCharacters, type Player } from "../hooks";
import type { PlayerStatus } from "../schemas";
import { CharactersEmptyState } from "./characters-empty-state";

const STATUS_LABELS: Record<PlayerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  done: "Done",
};

/**
 * Dashboard left-column "My Characters" section. Filters the
 * actor's Player rows to `active` + `inactive` per FR-029 — `done`
 * characters are hidden from the dashboard but remain reachable via
 * the "View all" link to `/characters` (which lists every status).
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
              <CharacterRow key={player.id} player={player} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CharacterRow({ player }: { player: Player }) {
  return (
    <li
      className="flex items-start justify-between gap-3 p-4"
      data-testid={`my-characters-row-${player.id}`}
    >
      <div className="min-w-0">
        <p className="font-medium text-foreground" data-testid="my-characters-name">
          {player.characterName}
        </p>
        {player.characterSummary ? (
          <p
            className="mt-1 truncate text-sm text-muted-foreground"
            data-testid="my-characters-summary"
          >
            {player.characterSummary}
          </p>
        ) : null}
      </div>
      <span
        className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground"
        data-testid="my-characters-status"
      >
        {STATUS_LABELS[player.status as PlayerStatus] ?? player.status}
      </span>
    </li>
  );
}

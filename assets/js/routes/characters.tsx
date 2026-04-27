import { createFileRoute, redirect } from "@tanstack/react-router";
import { useListMyCharacters, type Player } from "@/features/players/hooks";
import { CharactersEmptyState } from "@/features/players/components/characters-empty-state";
import type { PlayerStatus } from "@/features/players/schemas";

const STATUS_LABELS: Record<PlayerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  done: "Done",
};

export const Route = createFileRoute("/characters")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }
  },
  component: CharactersRoute,
});

export function CharactersRoute() {
  const characters = useListMyCharacters();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1
        data-route-heading
        tabIndex={-1}
        className="text-4xl font-bold tracking-tight"
      >
        My Characters
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every character you&apos;ve been seated as, across every game — including
        retired (&ldquo;Done&rdquo;) characters that are hidden from the dashboard.
      </p>

      <div className="mt-8">
        {characters.isPending ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading your characters…
          </p>
        ) : characters.isError ? (
          <p className="text-sm text-destructive" role="alert">
            We couldn&apos;t load your characters. Please refresh.
          </p>
        ) : characters.data && characters.data.length > 0 ? (
          <ul
            className="divide-y rounded-md border"
            data-testid="all-characters-list"
          >
            {characters.data.map((player) => (
              <CharacterRow key={player.id} player={player} />
            ))}
          </ul>
        ) : (
          <CharactersEmptyState />
        )}
      </div>
    </main>
  );
}

function CharacterRow({ player }: { player: Player }) {
  return (
    <li
      className="flex items-start justify-between gap-3 p-4"
      data-testid={`all-characters-row-${player.id}`}
    >
      <div className="min-w-0">
        <p className="font-medium text-foreground" data-testid="all-characters-name">
          {player.characterName}
        </p>
        {player.characterSummary ? (
          <p
            className="mt-1 text-sm text-muted-foreground"
            data-testid="all-characters-summary"
          >
            {player.characterSummary}
          </p>
        ) : null}
      </div>
      <span
        className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground"
        data-testid="all-characters-status"
      >
        {STATUS_LABELS[player.status as PlayerStatus] ?? player.status}
      </span>
    </li>
  );
}

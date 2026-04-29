import { createFileRoute, redirect } from "@tanstack/react-router";
import { useListMyCharacters } from "@/features/players/hooks";
import { CharacterCard } from "@/features/players/components/character-card";
import { CharactersEmptyState } from "@/features/players/components/characters-empty-state";

export const Route = createFileRoute("/characters/")({
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
              <CharacterCard
                key={player.id}
                player={player}
                testIdPrefix="all-characters-row"
              />
            ))}
          </ul>
        ) : (
          <CharactersEmptyState />
        )}
      </div>
    </main>
  );
}

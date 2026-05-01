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
    <main className="mx-auto max-w-3xl px-6 py-12 2xl:max-w-5xl">
      <h1
        data-route-heading
        tabIndex={-1}
        className="font-serif text-4xl font-bold tracking-tight"
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
            className="flex flex-col gap-3"
            data-testid="all-characters-list"
          >
            {characters.data.map((player) => (
              <li key={player.id}>
                <CharacterCard
                  player={player}
                  testIdPrefix="all-characters-row"
                />
              </li>
            ))}
          </ul>
        ) : (
          <CharactersEmptyState />
        )}
      </div>
    </main>
  );
}

import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { CharacterSchedulesSection } from "@/features/schedules/components/character-schedules-section";
import { ScheduleStatusBadge } from "@/features/schedules/components/schedule-status-badge";
import { useListSchedulesForCharacter } from "@/features/schedules/hooks";
import { useListMyCharacters } from "@/features/players/hooks";

export const Route = createFileRoute("/characters/$id/")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: CharacterDetailRoute,
});

function CharacterDetailRoute() {
  const { id } = Route.useParams();

  // The :list_mine read returns this character if the actor owns it.
  // Cross-tenant access falls through to "not found".
  const characters = useListMyCharacters();
  const character = characters.data?.find((c) => c.id === id);

  const schedules = useListSchedulesForCharacter(id);

  if (characters.isPending) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p>Loading character…</p>
      </main>
    );
  }

  if (!character) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-serif text-3xl font-bold tracking-tight" data-route-heading>
          Character not found
        </h1>
        <p className="mt-2 text-muted-foreground">
          You don&apos;t have access to this character.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/characters">Back to my characters</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12" id="main-content">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1
            data-route-heading
            tabIndex={-1}
            className="font-serif text-3xl font-bold tracking-tight"
          >
            {character.characterName}
          </h1>
          {character.characterSummary ? (
            <p className="mt-2 text-muted-foreground">
              {character.characterSummary}
            </p>
          ) : null}
          <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
            {character.status}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/characters">Back to my characters</Link>
        </Button>
      </header>

      {schedules.isPending ? (
        <p className="mt-10 text-sm text-muted-foreground">
          Loading schedules…
        </p>
      ) : schedules.isError ? (
        <p className="mt-10 text-sm text-destructive" role="alert">
          We couldn&apos;t load schedules. Please refresh.
        </p>
      ) : (
        <>
          <CharacterSchedulesSection
            audience={{ kind: "character", characterId: character.id }}
            schedules={schedules.data ?? []}
          />

          {(schedules.data ?? []).filter((s) => s.status !== "posted").length >
          0 ? (
            <section
              className="mt-10"
              aria-labelledby="character-availability-heading"
            >
              <h2
                id="character-availability-heading"
                className="text-xl font-semibold tracking-tight"
              >
                Awaiting your availability
              </h2>
              <ul
                className="mt-4 divide-y rounded-md border"
                data-testid="character-schedules-list"
              >
                {(schedules.data ?? [])
                  .filter((s) => s.status !== "posted")
                  .map((schedule) => (
                    <li
                      key={schedule.id}
                      className="flex items-center justify-between gap-3 p-4"
                      data-testid={`character-schedule-row-${schedule.id}`}
                    >
                      <div>
                        <p className="font-medium">{schedule.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <ScheduleStatusBadge status={schedule.status} />
                        <Button asChild variant="outline" size="sm">
                          <Link
                            to="/characters/$characterId/schedules/$scheduleId"
                            params={{
                              characterId: character.id,
                              scheduleId: schedule.id,
                            }}
                          >
                            Open
                          </Link>
                        </Button>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

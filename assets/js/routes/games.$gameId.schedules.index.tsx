import { createFileRoute, Link, redirect } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { SchedulesTable } from "@/features/schedules/components/schedules-table";
import { useListSchedulesForGame } from "@/features/schedules/hooks";

export const Route = createFileRoute("/games/$gameId/schedules/")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } });
    }
  },
  component: SchedulesIndexRoute,
});

function SchedulesIndexRoute() {
  const { gameId } = Route.useParams();
  const schedules = useListSchedulesForGame(gameId);

  return (
    <main className="container mx-auto py-8" id="main-content">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-route-heading>
            All schedules
          </h1>
          <p className="text-sm text-muted-foreground">
            Every schedule on this game, newest first.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/games/$id" params={{ id: gameId }}>
            Back to game
          </Link>
        </Button>
      </header>

      {schedules.isPending ? (
        <p>Loading schedules…</p>
      ) : schedules.isError ? (
        <p role="alert" className="text-destructive">
          Could not load schedules. Please refresh.
        </p>
      ) : (
        <SchedulesTable schedules={schedules.data ?? []} gameId={gameId} />
      )}
    </main>
  );
}

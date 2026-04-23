import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GameFieldRow } from "@/features/games/components/game-field-row";
import { useGame } from "@/features/games/hooks";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const Route = createFileRoute("/games/$id")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth?.isAuthenticated) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: location.href },
      });
    }
  },
  component: GameDetailRoute,
});

export function GameDetailRoute() {
  const { id } = Route.useParams();
  const game = useGame(id);

  if (game.isPending) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1
          data-route-heading
          tabIndex={-1}
          className="text-3xl font-bold tracking-tight"
        >
          Loading game…
        </h1>
      </main>
    );
  }

  if (game.isError || !game.data) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1
          data-route-heading
          tabIndex={-1}
          className="text-3xl font-bold tracking-tight"
        >
          Game not found
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          We couldn&apos;t find that game. It may have been deleted, or it belongs to someone
          else.
        </p>
        <div className="mt-6">
          <Button asChild variant="outline">
            <Link to="/dashboard" search={{}}>
              Back to dashboard
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  const { data: entry } = game;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1
          data-route-heading
          tabIndex={-1}
          className="text-3xl font-bold tracking-tight"
        >
          {entry.title}
        </h1>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" data-testid="game-detail-edit">
            <a href={`/games/${entry.id}/edit`}>Edit</a>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="game-detail-delete"
            disabled
            title="Delete lands in US4"
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <GameFieldRow id="title" label="Title">
          <p className="text-base" data-testid="game-detail-title">
            {entry.title}
          </p>
        </GameFieldRow>
        <GameFieldRow id="description" label="Description">
          <p
            className="whitespace-pre-wrap text-base text-muted-foreground"
            data-testid="game-detail-description"
          >
            {entry.description && entry.description.length > 0 ? entry.description : "—"}
          </p>
        </GameFieldRow>
        <GameFieldRow id="status" label="Status">
          <p className="text-base" data-testid="game-detail-status">
            {STATUS_LABELS[entry.status] ?? entry.status}
          </p>
        </GameFieldRow>
      </div>
    </main>
  );
}

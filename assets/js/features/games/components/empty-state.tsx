import { Button } from "@/components/ui/button";

export type GamesEmptyKind = "no_games_at_all" | "no_active_games";

export interface EmptyStateProps {
  kind: GamesEmptyKind;
  /** Only used by `no_active_games` copy. */
  totalCount?: number;
}

/**
 * Empty-state panel used by the dashboard's "My Active Games"
 * section and the All Games page. Discriminated on `kind` so the
 * copy differentiates "you have no games at all" from "you have
 * games, but none are Active". See spec FR-008 and the research.md
 * empty-state discrimination decision.
 */
export function GamesEmptyState({ kind, totalCount }: EmptyStateProps) {
  if (kind === "no_games_at_all") {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6"
        data-testid="games-empty-no-games"
      >
        <p className="text-sm text-muted-foreground">
          You haven&apos;t registered a game yet. Create your first one to get started.
        </p>
        <Button asChild size="sm">
          <a href="/games/new">Register your first game</a>
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6"
      data-testid="games-empty-no-active"
    >
      <p className="text-sm text-muted-foreground">
        No Active games.{" "}
        {typeof totalCount === "number" && totalCount > 0 ? (
          <>
            You have <span className="font-medium">{totalCount}</span> game
            {totalCount === 1 ? "" : "s"} in other statuses — visit All Games to find them.
          </>
        ) : null}
      </p>
      <div className="flex items-center gap-2">
        <Button asChild size="sm">
          <a href="/games/new">Create new game</a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href="/games">View All Games</a>
        </Button>
      </div>
    </div>
  );
}

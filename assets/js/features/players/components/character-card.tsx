import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import type { Player } from "../hooks";
import type { PlayerStatus } from "../schemas";

const STATUS_LABELS: Record<PlayerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  done: "Done",
};

export interface CharacterCardProps {
  player: Player;
  /**
   * Test-id prefix so dashboard and `/characters` rows have
   * disambiguated selectors. Each card emits `${testIdPrefix}-${player.id}`
   * on the wrapping `<li>` plus matching internal slots.
   */
  testIdPrefix: string;
}

/**
 * Single source of truth for the character row rendered in both the
 * dashboard's My Characters column and the `/characters` View All
 * page. Click target is an explicit View button so the card affords
 * a visible action next to the status pill.
 */
export function CharacterCard({ player, testIdPrefix }: CharacterCardProps) {
  return (
    <li
      className="flex items-start justify-between gap-3 p-4"
      data-testid={`${testIdPrefix}-${player.id}`}
    >
      <div className="min-w-0">
        <p
          className="font-medium text-foreground"
          data-testid={`${testIdPrefix}-name`}
        >
          {player.characterName}
        </p>
        {player.characterSummary ? (
          <p
            className="mt-1 truncate text-sm text-muted-foreground"
            data-testid={`${testIdPrefix}-summary`}
          >
            {player.characterSummary}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span
          className="text-xs uppercase tracking-wide text-muted-foreground"
          data-testid={`${testIdPrefix}-status`}
        >
          {STATUS_LABELS[player.status as PlayerStatus] ?? player.status}
        </span>
        <Button
          asChild
          variant="outline"
          size="sm"
          data-testid={`${testIdPrefix}-view-${player.id}`}
        >
          <Link to="/characters/$id" params={{ id: player.id }}>
            View
          </Link>
        </Button>
      </div>
    </li>
  );
}

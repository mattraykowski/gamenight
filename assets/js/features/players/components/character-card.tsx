import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Player } from "../hooks";
import type { PlayerStatus } from "../schemas";

const STATUS_LABELS: Record<PlayerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  done: "Done",
};

// Wax-seal palette per character status — matches the Stitch
// reference's "stamped" status indicator language.
const STATUS_CLASS: Record<PlayerStatus, string> = {
  active: "bg-secondary text-secondary-foreground border-secondary",
  inactive: "bg-muted text-muted-foreground border-muted-foreground/40",
  done:
    "bg-tertiary-fixed text-on-tertiary-fixed border-tertiary-fixed-dim",
};

export interface CharacterCardProps {
  player: Player;
  /**
   * Test-id prefix so dashboard and `/characters` rows have
   * disambiguated selectors. Each card emits `${testIdPrefix}-${player.id}`
   * on the wrapping element plus matching internal slots.
   */
  testIdPrefix: string;
}

/**
 * Adventurer's Journal — single character card rendered on both
 * the dashboard's My Characters column and the `/characters` View
 * All page. Each character gets its own piece of parchment with a
 * serif name, wax-seal status badge, and a primary "View" CTA.
 *
 * Renders as a `<Card>` (a `<div>`); callers wrap in `<li>` when
 * the surrounding context wants list semantics.
 */
export function CharacterCard({ player, testIdPrefix }: CharacterCardProps) {
  const status = (player.status as PlayerStatus) ?? "active";

  return (
    <Card
      data-testid={`${testIdPrefix}-${player.id}`}
      className="gap-3 py-4"
    >
      <CardHeader className="px-4">
        <CardTitle data-testid={`${testIdPrefix}-name`}>
          {player.characterName}
        </CardTitle>
        <CardAction>
          <Badge
            variant="waxSeal"
            className={cn(STATUS_CLASS[status])}
            data-testid={`${testIdPrefix}-status`}
          >
            {STATUS_LABELS[status] ?? player.status}
          </Badge>
        </CardAction>
      </CardHeader>

      {player.characterSummary ? (
        <CardContent className="px-4">
          <p
            className="line-clamp-2 text-sm text-muted-foreground"
            data-testid={`${testIdPrefix}-summary`}
          >
            {player.characterSummary}
          </p>
        </CardContent>
      ) : null}

      <CardFooter className="justify-end px-4">
        <Button
          asChild
          size="sm"
          data-testid={`${testIdPrefix}-view-${player.id}`}
        >
          <Link to="/characters/$id" params={{ id: player.id }}>
            View
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

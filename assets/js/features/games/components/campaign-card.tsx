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
import type { Game } from "../hooks";

const STATUS_LABEL: Record<Game["status"], string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
  completed: "Completed",
};

// Wax-seal palette per game status. Matches the sense of the design
// brief — primary forest for living campaigns, muted parchment for
// idle ones, error red for cancelled, gold for completed.
const STATUS_CLASS: Record<Game["status"], string> = {
  active: "bg-primary text-primary-foreground border-primary",
  paused:
    "bg-muted text-muted-foreground border-muted-foreground/40",
  cancelled:
    "bg-destructive text-destructive-foreground border-destructive",
  completed:
    "bg-tertiary-fixed text-on-tertiary-fixed border-tertiary-fixed-dim",
};

export interface CampaignCardProps {
  game: Game;
}

/**
 * Adventurer's Journal — single-game card for the dashboard's
 * "Campaigns I Lead" column. Replaces the tabular row in
 * `<GamesTable>` for surfaces where each game deserves its own
 * piece of parchment.
 *
 * Currently shows: title (serif), status (wax-seal badge),
 * description (2-line clamp), and a primary "View" CTA. Domain
 * data the design brief calls for (players count, next session,
 * location) lands when the underlying schemas grow them.
 */
export function CampaignCard({ game }: CampaignCardProps) {
  return (
    <Card data-testid={`campaign-card-${game.id}`} className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle data-testid="campaign-card-title">{game.title}</CardTitle>
        <CardAction>
          <Badge
            variant="waxSeal"
            className={cn(STATUS_CLASS[game.status])}
            data-testid="campaign-card-status"
          >
            {STATUS_LABEL[game.status]}
          </Badge>
        </CardAction>
      </CardHeader>

      {game.description ? (
        <CardContent className="px-4">
          <p
            className="line-clamp-2 text-sm text-muted-foreground"
            data-testid="campaign-card-description"
          >
            {game.description}
          </p>
        </CardContent>
      ) : null}

      <CardFooter className="justify-end px-4">
        <Button
          asChild
          size="sm"
          data-testid={`campaign-card-view-${game.id}`}
        >
          <Link to="/games/$id" params={{ id: game.id }}>
            View
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

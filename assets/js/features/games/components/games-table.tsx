import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDestroyGame, type Game } from "../hooks";
import { useToasts } from "@/features/toasts/toast-provider";
import { DeleteGameDialog } from "./delete-game-dialog";

const STATUS_LABELS: Record<Game["status"], string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
  completed: "Completed",
};

export interface GamesTableProps {
  games: Game[];
  /** When true, adds a status column (used by the All Games page). */
  showStatus?: boolean;
}

/**
 * Tabular display of Game rows. Used by both the dashboard section
 * (`showStatus={false}`) and the All Games page (`showStatus={true}`).
 * The action cell renders a view `<Link>` and a delete action that
 * opens a typed-confirmation modal (FR-016 / FR-017) before the
 * actual destroy. Buttons render at Shadcn `sm` size (height 32px,
 * ≥24×24 CSS px interactive target, WCAG 2.5.8).
 */
export function GamesTable({ games, showStatus = false }: GamesTableProps) {
  const destroy = useDestroyGame();
  const { push } = useToasts();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-1/4">Title</TableHead>
          <TableHead>Description</TableHead>
          {showStatus ? <TableHead className="w-[120px]">Status</TableHead> : null}
          <TableHead className="w-[180px] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {games.map((game) => (
          <TableRow key={game.id} data-testid={`game-row-${game.id}`}>
            <TableCell className="font-medium">
              <span className="line-clamp-1" data-testid="game-row-title">
                {game.title}
              </span>
            </TableCell>
            <TableCell>
              <span
                className="line-clamp-2 text-muted-foreground"
                data-testid="game-row-description"
              >
                {game.description ?? ""}
              </span>
            </TableCell>
            {showStatus ? (
              <TableCell>
                <span data-testid="game-row-status">{STATUS_LABELS[game.status]}</span>
              </TableCell>
            ) : null}
            <TableCell className="text-right">
              <div className="inline-flex items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  data-testid={`game-row-view-${game.id}`}
                >
                  <Link to="/games/$id" params={{ id: game.id }}>
                    View
                  </Link>
                </Button>
                <DeleteGameDialog
                  gameTitle={game.title}
                  isPending={destroy.isPending}
                  onConfirm={async () => {
                    try {
                      await destroy.mutateAsync({ id: game.id });
                      push({ title: "Game deleted.", variant: "success" });
                    } catch {
                      push({
                        title: "Could not delete the game. Please try again.",
                        variant: "error",
                      });
                    }
                  }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid={`game-row-delete-${game.id}`}
                  >
                    Delete
                  </Button>
                </DeleteGameDialog>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

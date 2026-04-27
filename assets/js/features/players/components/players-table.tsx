import { type ReactNode } from "react";
import type { Player, PlayerWithGmNotes } from "../hooks";
import type { PlayerStatus } from "../schemas";

const STATUS_LABELS: Record<PlayerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  done: "Done",
};

export interface PlayersTableProps {
  players: ReadonlyArray<Player | PlayerWithGmNotes>;
  /** When true, the table includes the gm_notes column. */
  showGmNotes?: boolean;
  /** Optional cell rendered at the end of each row — typically an Edit button. */
  renderActions?: (player: PlayerWithGmNotes | Player) => ReactNode;
}

/**
 * Renders a roster of players for a game. Two display modes:
 *
 * - Default (player view): character_name + character_summary + status.
 * - GM mode (`showGmNotes`): adds the gm_notes column and accepts an
 *   optional `renderActions` slot for the Edit button.
 *
 * Field-policy enforcement is server-side — `gm_notes` returns
 * `null` (or is omitted) for non-GM callers regardless of which
 * variant of this table renders. SC-005's zero-leak guarantee
 * lives at the Ash layer; this component just trusts the hook's
 * response shape.
 */
export function PlayersTable({
  players,
  showGmNotes = false,
  renderActions,
}: PlayersTableProps) {
  if (players.length === 0) {
    return (
      <p
        className="rounded-md border bg-muted px-4 py-6 text-center text-sm text-muted-foreground"
        data-testid="players-table-empty"
      >
        No players yet.
      </p>
    );
  }

  return (
    <table
      className="w-full table-fixed border-collapse text-sm"
      data-testid={showGmNotes ? "players-table-gm" : "players-table"}
    >
      <thead className="border-b text-left">
        <tr>
          <th scope="col" className="py-2 pr-3 font-medium">
            Character
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            Summary
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            Status
          </th>
          {showGmNotes ? (
            <th scope="col" className="py-2 pr-3 font-medium">
              GM notes
            </th>
          ) : null}
          {renderActions ? (
            <th scope="col" className="py-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          ) : null}
        </tr>
      </thead>
      <tbody>
        {players.map((player) => (
          <tr
            key={player.id}
            className="border-b last:border-b-0"
            data-testid={`players-table-row-${player.id}`}
          >
            <td className="py-3 pr-3 align-top font-medium" data-testid="players-character-name">
              {player.characterName}
            </td>
            <td
              className="py-3 pr-3 align-top text-muted-foreground"
              data-testid="players-character-summary"
            >
              {player.characterSummary && player.characterSummary.length > 0
                ? player.characterSummary
                : "—"}
            </td>
            <td className="py-3 pr-3 align-top" data-testid="players-status">
              {STATUS_LABELS[player.status as PlayerStatus] ?? player.status}
            </td>
            {showGmNotes ? (
              <td
                className="py-3 pr-3 align-top text-muted-foreground"
                data-testid="players-gm-notes"
              >
                {"visibleGmNotes" in player && player.visibleGmNotes
                  ? player.visibleGmNotes
                  : "—"}
              </td>
            ) : null}
            {renderActions ? (
              <td className="py-3 text-right align-top">{renderActions(player)}</td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

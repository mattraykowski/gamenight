import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GameFieldRow } from "@/features/games/components/game-field-row";
import { DeleteGameDialog } from "@/features/games/components/delete-game-dialog";
import { useDestroyGame, useGame } from "@/features/games/hooks";
import { InvitationForm } from "@/features/invitations/components/invitation-form";
import { PendingInvitationsList } from "@/features/invitations/components/pending-invitations-list";
import { RevokeInvitationDialog } from "@/features/invitations/components/revoke-invitation-dialog";
import {
  useCreateInvitation,
  useListPendingInvitationsForGame,
  useRevokeInvitation,
  type Invitation,
} from "@/features/invitations/hooks";
import {
  toCreateInvitationInput,
  type InvitationFormValues,
} from "@/features/invitations/schemas";
import { PlayersTable } from "@/features/players/components/players-table";
import { PlayerEditDialog } from "@/features/players/components/player-edit-dialog";
import {
  useListPlayersForGame,
  useListPlayersForGm,
  useUpdatePlayer,
  type PlayerWithGmNotes,
} from "@/features/players/hooks";
import {
  toUpdatePlayerInput,
  type PlayerEditFormValues,
  type PlayerStatus,
} from "@/features/players/schemas";
import { useToasts } from "@/features/toasts/toast-provider";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const Route = createFileRoute("/games/$id/")({
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
  const destroy = useDestroyGame();
  const createInvitation = useCreateInvitation();
  const revoke = useRevokeInvitation();
  const updatePlayer = useUpdatePlayer();
  const navigate = useNavigate();
  const { push } = useToasts();

  const isOwner = game.data?.isOwner === true;

  // GMs use the GM-only roster (with visible_gm_notes); players use
  // the lighter shared roster.
  const playerRoster = useListPlayersForGame(id);
  const gmRoster = useListPlayersForGm(id);
  const pendingInvites = useListPendingInvitationsForGame(id);

  async function onDelete() {
    try {
      await destroy.mutateAsync({ id });
      push({ title: "Game deleted.", variant: "success" });
      await navigate({ to: "/dashboard", search: {} });
    } catch {
      push({
        title: "Could not delete the game. Please try again.",
        variant: "error",
      });
    }
  }

  async function onInvite(values: InvitationFormValues) {
    try {
      await createInvitation.mutateAsync(toCreateInvitationInput(values, id));
      push({ title: "Invitation sent.", variant: "success" });
    } catch {
      push({
        title: "Could not send the invitation. Please try again.",
        variant: "error",
      });
    }
  }

  async function onRevoke(invitation: Invitation) {
    try {
      await revoke.mutateAsync({ id: invitation.id });
      push({ title: "Invitation revoked.", variant: "info" });
    } catch {
      push({
        title: "Could not revoke the invitation. Please try again.",
        variant: "error",
      });
    }
  }

  async function onUpdatePlayer(player: PlayerWithGmNotes, values: PlayerEditFormValues) {
    try {
      await updatePlayer.mutateAsync({
        id: player.id,
        ...toUpdatePlayerInput(values),
      });
      push({ title: "Player updated.", variant: "success" });
    } catch {
      push({
        title: "Could not update the player. Please try again.",
        variant: "error",
      });
    }
  }

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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1
          data-route-heading
          tabIndex={-1}
          className="text-3xl font-bold tracking-tight"
        >
          {entry.title}
        </h1>
        {isOwner ? (
          <div className="flex items-center gap-2">
            <Button asChild size="sm" data-testid="game-detail-edit">
              <Link to="/games/$id/edit" params={{ id: entry.id }}>
                Edit
              </Link>
            </Button>
            <DeleteGameDialog
              gameTitle={entry.title}
              isPending={destroy.isPending}
              onConfirm={onDelete}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="game-detail-delete"
              >
                Delete
              </Button>
            </DeleteGameDialog>
          </div>
        ) : null}
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

      <section
        className="mt-12 border-t pt-8"
        aria-labelledby="players-roster-heading"
      >
        <h2 id="players-roster-heading" className="text-2xl font-semibold tracking-tight">
          Players
        </h2>
        <div className="mt-4">
          {isOwner ? (
            gmRoster.isPending ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Loading roster…
              </p>
            ) : gmRoster.isError ? (
              <p
                className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                We couldn&apos;t load the roster. Please refresh.
              </p>
            ) : (
              <PlayersTable
                players={gmRoster.data ?? []}
                showGmNotes
                renderActions={(player) => (
                  <PlayerEditDialog
                    player={{
                      id: player.id,
                      characterName: player.characterName,
                      characterSummary: player.characterSummary,
                      visibleGmNotes:
                        "visibleGmNotes" in player ? (player.visibleGmNotes ?? null) : null,
                      status: player.status as PlayerStatus,
                    }}
                    isPending={updatePlayer.isPending}
                    onSubmit={(values) =>
                      onUpdatePlayer(player as PlayerWithGmNotes, values)
                    }
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid={`player-edit-trigger-${player.id}`}
                    >
                      Edit
                    </Button>
                  </PlayerEditDialog>
                )}
              />
            )
          ) : playerRoster.isPending ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading roster…
            </p>
          ) : playerRoster.isError ? (
            <p
              className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              We couldn&apos;t load the roster. Please refresh.
            </p>
          ) : (
            <PlayersTable players={playerRoster.data ?? []} />
          )}
        </div>
      </section>

      {isOwner ? (
        <>
          <section
            className="mt-12 border-t pt-8"
            aria-labelledby="pending-invitations-heading"
          >
            <h2
              id="pending-invitations-heading"
              className="text-2xl font-semibold tracking-tight"
            >
              Pending invitations
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Visible only to you.
            </p>
            <div className="mt-4">
              {pendingInvites.isPending ? (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Loading invitations…
                </p>
              ) : pendingInvites.isError ? (
                <p
                  className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  We couldn&apos;t load pending invitations. Please refresh.
                </p>
              ) : (
                <PendingInvitationsList
                  invitations={pendingInvites.data ?? []}
                  renderActions={(invitation) => (
                    <RevokeInvitationDialog
                      invitation={{
                        id: invitation.id,
                        email: String(invitation.email),
                        characterName: invitation.characterName,
                      }}
                      isPending={revoke.isPending}
                      onConfirm={() => onRevoke(invitation)}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`revoke-invitation-trigger-${invitation.id}`}
                      >
                        Revoke
                      </Button>
                    </RevokeInvitationDialog>
                  )}
                />
              )}
            </div>
          </section>

          <section
            className="mt-12 border-t pt-8"
            aria-labelledby="invite-player-heading"
          >
            <h2 id="invite-player-heading" className="text-2xl font-semibold tracking-tight">
              Invite a player
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Send an invitation. We&apos;ll email a link the invitee can use to accept and
              join your roster.
            </p>
            <div className="mt-6">
              <InvitationForm onSubmit={onInvite} isSubmitting={createInvitation.isPending} />
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

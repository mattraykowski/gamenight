import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GameFieldRow } from "@/features/games/components/game-field-row";
import { DeleteGameDialog } from "@/features/games/components/delete-game-dialog";
import { useDestroyGame, useGame } from "@/features/games/hooks";
import { InvitePlayerDialog } from "@/features/invitations/components/invite-player-dialog";
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
import { CharacterSchedulesSection } from "@/features/schedules/components/character-schedules-section";
import { InitiateScheduleDialog } from "@/features/schedules/components/initiate-schedule-dialog";
import { SchedulesTable } from "@/features/schedules/components/schedules-table";
import {
  useInitiateSchedule,
  useListSchedulesForGameTopSix,
} from "@/features/schedules/hooks";
import type { InitiateScheduleInput } from "@/ash_rpc";
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
  const schedulesTopSix = useListSchedulesForGameTopSix(id);
  const initiateSchedule = useInitiateSchedule();

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

  async function onInitiateSchedule(input: InitiateScheduleInput) {
    try {
      const created = await initiateSchedule.mutateAsync(input);
      push({ title: "Schedule initiated.", variant: "success" });
      await navigate({
        to: "/games/$gameId/schedules/$scheduleId",
        params: { gameId: id, scheduleId: created.id },
      });
    } catch {
      push({
        title: "Could not initiate the schedule. Please try again.",
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
    <main className="mx-auto max-w-5xl px-6 py-12">
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

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <div className="space-y-6">
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

        {isOwner ? (
          <aside aria-label="Upcoming schedule overview">
            {schedulesTopSix.isPending ? (
              <p className="text-sm text-muted-foreground">Loading schedules…</p>
            ) : schedulesTopSix.isError ? (
              <p
                className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                We couldn&apos;t load schedules. Please refresh.
              </p>
            ) : (
              <CharacterSchedulesSection
                audience={{ kind: "game", gameId: id }}
                schedules={schedulesTopSix.data ?? []}
                hideHeader
              />
            )}
          </aside>
        ) : null}
      </div>

      <section
        className="mt-12 border-t pt-8"
        aria-labelledby="players-roster-heading"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 id="players-roster-heading" className="text-2xl font-semibold tracking-tight">
            Players
          </h2>
          {isOwner ? (
            <InvitePlayerDialog
              onSubmit={onInvite}
              isPending={createInvitation.isPending}
            >
              <Button type="button" size="sm" data-testid="invite-player-trigger">
                Invite player
              </Button>
            </InvitePlayerDialog>
          ) : null}
        </div>
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
      ) : null}

      {isOwner ? (
        <section className="mt-12" aria-labelledby="schedules-heading">
          <div className="flex items-center justify-between">
            <h2
              id="schedules-heading"
              className="text-xl font-semibold tracking-tight"
            >
              Schedules
            </h2>
            <div className="flex items-center gap-2">
              <InitiateScheduleDialog
                gameId={id}
                onSubmit={onInitiateSchedule}
                isPending={initiateSchedule.isPending}
              >
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  data-testid="initiate-schedule-trigger"
                >
                  Initiate schedule
                </Button>
              </InitiateScheduleDialog>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="view-all-schedules"
                onClick={() =>
                  void navigate({
                    to: "/games/$gameId/schedules",
                    params: { gameId: id },
                  })
                }
              >
                View all schedules
              </Button>
            </div>
          </div>
          <div className="mt-4">
            {schedulesTopSix.isPending ? (
              <p>Loading schedules…</p>
            ) : schedulesTopSix.isError ? (
              <p
                className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                We couldn&apos;t load schedules. Please refresh.
              </p>
            ) : (
              <SchedulesTable
                schedules={schedulesTopSix.data ?? []}
                gameId={id}
              />
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}

defmodule GameNight.Games.Invitation.Actions.AcceptInvitation do
  @moduledoc """
  Implementation of the `:accept_invitation` generic action — the
  JSON:API entry point for accepting an invitation.

  Why a generic action wrapper around `:accept_with_token`: the
  underlying update action requires the invitation to be *loadable*
  by the acting user, but the invitee's primary email may differ
  from the email the GM invited (the spec edge case "user registers
  with a different email — link still works"). ash_json_api's
  default PATCH flow loads the row via the resource's read policy
  before applying the update, so the invitee would 404 there. This
  action sidesteps that load step:

    1. Loads the invitation by id with `authorize?: false`. The
       authorization gate IS the token verification step (2), so
       running the load under the actor's policy would be a
       redundant — and stricter — layer.
    2. Dispatches to `:accept_with_token`, which verifies the
       supplied token, creates the Player, and revokes the token.
    3. Returns a small map (`id`, `status`, `accepted_player_id`)
       suitable for the SPA's accept-page success state.
  """
  use Ash.Resource.Actions.Implementation

  alias GameNight.Games.Invitation

  @impl true
  def run(input, _opts, context) do
    actor = context.actor
    id = input.arguments.id
    token = input.arguments.token

    with %_{} = invitation <- Ash.get!(Invitation, id, authorize?: false),
         {:ok, accepted} <-
           invitation
           |> Ash.Changeset.for_update(:accept_with_token, %{token: token}, actor: actor)
           |> Ash.update() do
      {:ok,
       %{
         id: accepted.id,
         status: accepted.status,
         accepted_player_id: accepted.accepted_player_id
       }}
    end
  end
end

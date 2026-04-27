defmodule GameNight.Games.Invitation.Actions.PreviewWithToken do
  @moduledoc """
  Implementation of the `:preview_with_token` generic action on
  `GameNight.Games.Invitation`. Returns an `Invitation.Preview`
  struct for any caller (anonymous or authenticated) who can present
  a valid acceptance token.

  Reads the invitation with `authorize?: false` because the action's
  authorization gate IS the token — running the read under the
  caller's policy would force them to be the GM or the invitee, which
  defeats the whole point (the recipient may not yet have an account
  whose email matches the invited address).
  """
  use Ash.Resource.Actions.Implementation

  alias GameNight.Games.Invitation
  alias GameNight.Games.Invitation.Tokens

  @impl true
  def run(input, _opts, _context) do
    token = input.arguments.token

    with {:ok, invitation_id} <- Tokens.verify(token),
         {:ok, inv} <-
           Invitation
           |> Ash.get(invitation_id, authorize?: false, load: [:game, :inviter]),
         :pending <- inv.status do
      {:ok,
       %{
         id: inv.id,
         game_title: inv.game.title,
         inviter_email: to_string(inv.inviter.email),
         character_name: inv.character_name,
         expires_at: inv.expires_at
       }}
    else
      _ ->
        {:error,
         Ash.Error.Action.InvalidArgument.exception(
           field: :token,
           message: "invalid_token"
         )}
    end
  end
end

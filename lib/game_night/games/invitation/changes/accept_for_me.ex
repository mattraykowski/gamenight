defmodule GameNight.Games.Invitation.Changes.AcceptForMe do
  @moduledoc """
  Change for `Invitation.accept_for_me` — the in-app accept path
  used by the notifications bell + the `/invitations` list. Same
  business logic as `Changes.Accept` (upsert Player, stamp
  `accepted`, revoke token, resolve notification) except:

    - **No token argument**. The caller is the matching recipient
      (the action's policy authorises on
      `email == ^actor(:email)`). The recipient is the only person
      who can hit this path, so the token-bearer auth that gates
      `:accept_with_token` is unnecessary here.
    - The original token JTI is still revoked so the email link
      can't be redeemed after the in-app accept fires.
  """
  use Ash.Resource.Change

  alias Ash.Changeset
  alias GameNight.Accounts.Token
  alias GameNight.Games.Player
  alias GameNight.Notifications.System, as: NotificationsSystem

  @impl true
  def change(changeset, _opts, _context) do
    changeset
    |> Changeset.before_action(&before_action/1)
    |> Changeset.after_action(&after_action/2)
  end

  defp before_action(changeset) do
    invitation = changeset.data
    actor = current_actor(changeset)

    with :pending <- invitation.status,
         %{id: _user_id} = actor when not is_nil(actor) <- actor,
         {:ok, player} <- upsert_player(invitation, actor) do
      changeset
      |> Changeset.force_change_attribute(:status, :accepted)
      |> Changeset.force_change_attribute(:accepted_player_id, player.id)
    else
      :accepted ->
        Changeset.add_error(changeset, message: "invitation has already been accepted")

      :declined ->
        Changeset.add_error(changeset, message: "invitation has been declined")

      :revoked ->
        Changeset.add_error(changeset, message: "invitation has been revoked")

      nil ->
        Changeset.add_error(changeset, message: "actor required to accept an invitation")

      {:error, %Ash.Error.Invalid{} = err} ->
        Changeset.add_error(changeset, err)

      {:error, _} ->
        Changeset.add_error(changeset, message: "could not create player")
    end
  end

  defp after_action(_changeset, invitation) do
    case revoke_token(invitation) do
      :ok ->
        NotificationsSystem.resolve_for_subject("invitation", invitation.id)
        {:ok, invitation}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp current_actor(changeset) do
    changeset.context[:private][:actor] || changeset.context[:actor]
  end

  defp upsert_player(invitation, %{id: user_id}) do
    Player
    |> Ash.Changeset.for_create(:create, %{
      game_id: invitation.game_id,
      user_id: user_id,
      character_name: invitation.character_name,
      character_summary: invitation.character_summary,
      gm_notes: invitation.gm_notes,
      status: :active
    })
    |> Ash.create(authorize?: false)
  end

  defp revoke_token(invitation) do
    AshAuthentication.TokenResource.Actions.revoke_jti(
      Token,
      invitation.token_jti,
      "invitation:#{invitation.id}"
    )
  end
end

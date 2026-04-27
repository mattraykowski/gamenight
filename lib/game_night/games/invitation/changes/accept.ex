defmodule GameNight.Games.Invitation.Changes.Accept do
  @moduledoc """
  Change for `Invitation.accept_with_token`. In `before_action`:

    1. Verifies the supplied token resolves to the invitation being
       acted on (and that the invitation is still `:pending`).
    2. Creates (or upserts on conflict) the corresponding Player
       record under `authorize?: false`. Player has no public create
       action, and the token is itself the authorization the caller
       supplied.
    3. Stamps the invitation with `status: :accepted` and
       `accepted_player_id` so the single update writes both columns
       atomically alongside the Player insert.

  In `after_action`:

    4. Revokes the token JTI so the same link cannot be redeemed
       again.
    5. Calls `GameNight.Notifications.System.resolve_for_subject/2`
       so any matching notification's `resolved_at` is set (no-op for
       US1; full body in US2 T057).

  Player creation lives in `before_action` (not `after_action`)
  because the invitation's `accepted_player_id` column must be set
  in the same changeset. Doing it post-action would require either a
  second invitation update or a dedicated set-accepted-player action.
  """
  use Ash.Resource.Change

  alias Ash.Changeset
  alias GameNight.Accounts.Token
  alias GameNight.Games.Invitation.Tokens
  alias GameNight.Games.Player
  alias GameNight.Notifications.System, as: NotificationsSystem

  @impl true
  def change(changeset, _opts, _context) do
    changeset
    |> Changeset.before_action(&before_action/1)
    |> Changeset.after_action(&after_action/2)
  end

  defp before_action(changeset) do
    token = Changeset.get_argument(changeset, :token)
    invitation = changeset.data
    actor = current_actor(changeset)

    with :pending <- invitation.status,
         {:ok, invitation_id} <- Tokens.verify(token),
         true <- invitation_id == invitation.id,
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

      false ->
        Changeset.add_error(changeset, field: :token, message: "invalid_token")

      {:error, %Ash.Error.Invalid{} = err} ->
        Changeset.add_error(changeset, err)

      {:error, _other} ->
        Changeset.add_error(changeset, field: :token, message: "invalid_token")
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

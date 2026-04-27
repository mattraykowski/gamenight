defmodule GameNight.Games.Invitation.Changes.Decline do
  @moduledoc """
  Change for `Invitation.decline_with_token`. Mirrors `Changes.Accept`
  except that **no Player record is created** — the invitation simply
  closes.

  In `before_action`:

    1. Verifies the supplied token resolves to the invitation being
       acted on (and that the invitation is still `:pending`).
    2. Stamps the invitation with `status: :declined`.

  In `after_action`:

    3. Revokes the token JTI on `GameNight.Accounts.Token` so the
       same link cannot be redeemed again.
    4. Calls `GameNight.Notifications.System.resolve_for_subject/2`
       so any matching in-app notification is marked resolved.
  """
  use Ash.Resource.Change

  alias Ash.Changeset
  alias GameNight.Accounts.Token
  alias GameNight.Games.Invitation.Tokens
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
         %{id: _user_id} when not is_nil(actor) <- actor do
      Changeset.force_change_attribute(changeset, :status, :declined)
    else
      :accepted ->
        Changeset.add_error(changeset, message: "invitation has already been accepted")

      :declined ->
        Changeset.add_error(changeset, message: "invitation has already been declined")

      :revoked ->
        Changeset.add_error(changeset, message: "invitation has been revoked")

      nil ->
        Changeset.add_error(changeset, message: "actor required to decline an invitation")

      false ->
        Changeset.add_error(changeset, field: :token, message: "invalid_token")

      {:error, _} ->
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

  defp revoke_token(invitation) do
    AshAuthentication.TokenResource.Actions.revoke_jti(
      Token,
      invitation.token_jti,
      "invitation:#{invitation.id}"
    )
  end
end

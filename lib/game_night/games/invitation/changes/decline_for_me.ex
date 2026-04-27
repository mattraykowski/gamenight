defmodule GameNight.Games.Invitation.Changes.DeclineForMe do
  @moduledoc """
  Change for `Invitation.decline_for_me` — the in-app decline path
  for the notifications bell + the `/invitations` list. Mirrors
  `Changes.Decline` except authorisation is via email-match (the
  action's policy) rather than a token argument.
  """
  use Ash.Resource.Change

  alias Ash.Changeset
  alias GameNight.Accounts.Token
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

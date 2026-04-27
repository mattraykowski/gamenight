defmodule GameNight.Games.Invitation.Changes.Revoke do
  @moduledoc """
  Change for `Invitation.revoke`. In `before_action`:

    - Verifies the invitation is still `:pending`. Anything else
      (already accepted / declined / revoked) is a friendly error.
    - Flips `status` to `:revoked`.

  In `after_action`:

    - Revokes the token JTI on `GameNight.Accounts.Token` so the
      original email link is no longer redeemable.
    - Calls `Notifications.System.resolve_for_subject/2` so any
      matching in-app notification is marked resolved (the bell
      stops surfacing it).

  Token revocation and notification resolution can both be retried
  if a future migration needs them — they're idempotent at the
  AshAuthentication and Notifications layers.
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
    case changeset.data.status do
      :pending ->
        Changeset.force_change_attribute(changeset, :status, :revoked)

      :accepted ->
        Changeset.add_error(changeset,
          message: "this invitation has already been accepted; revoke is not applicable"
        )

      :declined ->
        Changeset.add_error(changeset,
          message: "this invitation has already been declined"
        )

      :revoked ->
        Changeset.add_error(changeset, message: "this invitation has already been revoked")
    end
  end

  defp after_action(_changeset, invitation) do
    case AshAuthentication.TokenResource.Actions.revoke_jti(
           Token,
           invitation.token_jti,
           "invitation:#{invitation.id}"
         ) do
      :ok ->
        NotificationsSystem.resolve_for_subject("invitation", invitation.id)
        {:ok, invitation}

      {:error, reason} ->
        {:error, reason}
    end
  end
end

defmodule GameNight.Games.Invitation.Changes.MintTokenAndDeliver do
  @moduledoc """
  Change for `Invitation.create_for_game` that:

    1. (before_action) generates an invitation id up-front, mints an
       acceptance token via `GameNight.Games.Invitation.Tokens.mint/1`,
       and stamps the `id`, `token_jti`, and `expires_at` attributes
       onto the changeset. Stashes the JWT in the changeset's context
       under `:invitation_token` so the after_action can read it
       without re-deriving.
    2. (after_action) loads the freshly-created invitation's `:game`
       relationship (so the email body can mention the title), sends
       the invitation email via
       `GameNight.Games.Invitation.Senders.SendInvitationEmail`, and
       calls `GameNight.Notifications.System.create_for_invitation/1`
       (no-op for US1, full body in US2 T057).

  Why a custom Change rather than inline `change before_action(...)`:
  the body has multiple coordinated steps, an error path that must
  abort the create cleanly, and is exercised by both unit tests
  (this file is the seam they target) and the eventual JSON:API
  request tests. A named module keeps the logic discoverable and
  diffable.
  """
  use Ash.Resource.Change

  alias Ash.Changeset
  alias GameNight.Games.Invitation.Senders.SendInvitationEmail
  alias GameNight.Games.Invitation.Tokens
  alias GameNight.Notifications.System, as: NotificationsSystem

  @impl true
  def change(changeset, _opts, _context) do
    changeset
    |> Changeset.before_action(&before_action/1)
    |> Changeset.after_action(&after_action/2)
  end

  defp before_action(changeset) do
    invitation_id = Ash.UUID.generate()
    ttl_days = Application.fetch_env!(:game_night, :invitation_token_ttl_days)
    expires_at = DateTime.add(DateTime.utc_now(), ttl_days * 86_400, :second)

    case Tokens.mint(%{id: invitation_id}) do
      {:ok, token, jti} ->
        changeset
        |> Changeset.force_change_attribute(:id, invitation_id)
        |> Changeset.force_change_attribute(:token_jti, jti)
        |> Changeset.force_change_attribute(:expires_at, expires_at)
        |> Changeset.put_context(:invitation_token, token)

      {:error, reason} ->
        Changeset.add_error(
          changeset,
          field: :base,
          message: "could not mint invitation token: #{inspect(reason)}"
        )
    end
  end

  defp after_action(changeset, invitation) do
    token = Map.get(changeset.context, :invitation_token)

    # Reload the invitation with :game preloaded so the email body
    # can quote the title without a second DB round trip in the
    # sender. We use authorize?: false because we are running inside
    # the action that just authorized the GM — there is no second
    # trust boundary to clear.
    case Ash.load(invitation, :game, authorize?: false) do
      {:ok, with_game} ->
        # Email + notification side effects. Failures here do not
        # roll back the invitation row in v1 — see plan.md §VI.
        SendInvitationEmail.send(with_game, token, [])
        NotificationsSystem.create_for_invitation(with_game)
        {:ok, with_game}

      {:error, reason} ->
        {:error, reason}
    end
  end
end

defmodule GameNight.Games.Invitation.Senders.SendInvitationEmail do
  @moduledoc """
  Sends an invitation email to the invited address.

  Mirrors the shape of `GameNight.Accounts.User.Senders.SendMagicLinkEmail`
  (Swoosh + verified routes), so the existing `TestMailboxController`
  and the `/dev/mailbox` preview both work without additional wiring.

  HTML escaping per Sobelow: every interpolated attribute (game
  title, character name) goes through `Phoenix.HTML.html_escape/1`
  to rule out template-level XSS. The token rides only in the URL
  (no HTML context) and inherits the `~p` sigil's encoding behaviour.
  """
  use GameNightWeb, :verified_routes

  import Swoosh.Email

  alias GameNight.Mailer

  @doc """
  Deliver the invitation email. Called from
  `Invitation.create_for_game`'s after-action change.
  """
  @spec send(GameNight.Games.Invitation.t() | map(), String.t(), keyword()) ::
          :ok | {:error, term()}
  def send(invitation, token, _opts \\ []) do
    new()
    |> from({"Game Night", from_address()})
    |> to(to_string(invitation.email))
    |> subject("You've been invited to a game")
    |> html_body(body(%{invitation: invitation, token: token}))
    |> Mailer.deliver()
    |> case do
      {:ok, _} -> :ok
      other -> other
    end
  end

  defp body(%{invitation: invitation, token: token}) do
    url = url(~p"/invitations/#{token}")
    title = invitation.game.title |> escape()
    character_name = invitation.character_name |> escape()

    """
    <p>You've been invited to play in <strong>#{title}</strong> as <strong>#{character_name}</strong>.</p>
    <p>Click the link below to accept the invitation:</p>
    <p><a href="#{url}">#{url}</a></p>
    """
  end

  defp escape(value) do
    value
    |> Phoenix.HTML.html_escape()
    |> Phoenix.HTML.safe_to_string()
  end

  defp from_address do
    # Reads `:transactional_email_from` (the shared key all senders
    # use after the Phase 9 cleanup); the legacy `:invitation_email_from`
    # remains as a fallback alias in `config/runtime.exs`.
    Application.fetch_env!(:game_night, :transactional_email_from)
  end
end

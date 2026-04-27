defmodule GameNight.Games.Invitation.Senders.SendInvitationEmail do
  @moduledoc """
  Sends an invitation email to the invited address.

  Mirrors the shape of `GameNight.Accounts.User.Senders.SendMagicLinkEmail`
  (Swoosh + verified routes), so the existing `TestMailboxController`
  and the `/dev/mailbox` preview both work without additional wiring.

  **Body lands in US1 T031.** For foundational work, the module exists
  with a `send/3` stub so call sites (e.g. `Invitation.create_for_game`'s
  `after_action`) can be wired in dependency order. Calling `send/3`
  in this state returns `:ok` without delivering anything — the unit
  tests in T023 will fail (RED) until T031 fills in the body.

  ### Inputs

  The contract matches what an `after_action` change passes:
    * `invitation` — the freshly-created `%GameNight.Games.Invitation{}`
      struct (with `:game` loaded, so the email body can mention the
      title without a second DB hit).
    * `token` — the JWT minted by `GameNight.Games.Invitation.Tokens.mint/1`.
    * `opts` — currently unused; reserved for future per-call overrides
      (e.g. a custom from-address for system-test fixtures).

  HTML escaping per Sobelow: the eventual body interpolates the game
  title and character name through `Phoenix.HTML.html_escape/1` to
  rule out template-level XSS. The token itself is URL-only (no HTML
  context) and does not need additional escaping beyond `~p`.
  """
  use GameNightWeb, :verified_routes

  @doc """
  Deliver the invitation email. Stub for foundational work — body
  lands in US1 T031.
  """
  @spec send(GameNight.Games.Invitation.t() | map(), String.t(), keyword()) :: :ok
  def send(_invitation, _token, _opts \\ []) do
    # Stub — real implementation in US1 T031:
    #   * builds a Swoosh.Email with from: from_address(),
    #   * to: invitation.email,
    #   * subject: "You've been invited to a game",
    #   * html_body: rendered HTML referencing url(~p"/invitations/#{token}"),
    #   * delivers via GameNight.Mailer.deliver!/1.
    :ok
  end

  @doc false
  def from_address do
    Application.fetch_env!(:game_night, :invitation_email_from)
  end
end

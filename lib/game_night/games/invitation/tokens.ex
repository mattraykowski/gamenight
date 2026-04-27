defmodule GameNight.Games.Invitation.Tokens do
  @moduledoc """
  Mint and verify per-invitation acceptance tokens.

  Tokens are JWTs minted via `AshAuthentication.Jwt` and stored as
  rows on the existing `GameNight.Accounts.Token` resource (purpose
  `"invitation_accept"`, subject `"invitation:<uuid>"`). Reusing the
  AshAuthentication token table gives us revocation, expiration, and
  the `expunge_expired` cron for free — see
  `specs/002-invite-players/research.md` §2 for the full rationale.

  ### What this token authorises

  The token authorises *the action* (accept / decline an invitation),
  not *the actor*. Whoever holds the token at the time
  `Invitation.accept_with_token` runs becomes the seated player —
  even if they registered with a different email than the one
  invited. This matches the spec edge case "user registers with a
  different email — the link still works."

  The actor on the action is the **session user** (whoever is logged
  in); the token is the proof-of-invitation that gates the action.
  An anonymous caller cannot accept (the action requires
  `actor_present()`), but the token's role is independent of the
  actor's identity.

  ### Token lifecycle

  * `mint/1` — call from `Invitation.create_for_game`'s after-action.
    Generates the JWT, stores the row, returns `{token, jti}` so the
    caller can persist `token_jti` on the invitation row for later
    revocation.
  * `verify/1` — call from `:preview_with_token`,
    `:accept_with_token`, `:decline_with_token`. Returns
    `{:ok, invitation_id}` for valid tokens, `{:error, reason}`
    otherwise.
  * Revocation happens elsewhere (in the action that transitions the
    invitation to a terminal state) via
    `GameNight.Accounts.Token.revoke_jti/1` keyed on the persisted
    `token_jti`.

  **Bodies land in US1 T029.** The signatures exist now so the
  Invitation actions and the SPA's `/invitations/:token` route can be
  wired in dependency order during US1 work.
  """

  @typedoc "Opaque JWT string carried in the email URL."
  @type token :: String.t()

  @typedoc "JWT identifier used for revocation."
  @type jti :: String.t()

  @doc """
  Mint a new invitation-acceptance token for `invitation`.

  Returns `{:ok, token, jti}` on success. The caller persists `jti`
  on the invitation row (`token_jti` attribute) so revocation has a
  stable handle.

  **Body lands in US1 T029.**
  """
  @spec mint(GameNight.Games.Invitation.t() | map()) :: {:ok, token(), jti()} | {:error, term()}
  def mint(_invitation) do
    # Stub — real implementation in US1 T029:
    #   1. Build a JWT via AshAuthentication.Jwt.token_for_user/4 with
    #      purpose: :invitation_accept, subject: "invitation:#{id}",
    #      token_lifetime: configured TTL (`:invitation_token_ttl_days`).
    #   2. Persist the row on GameNight.Accounts.Token via the
    #      `:store_token` action under `authorize?: false` (system
    #      call, comment in code justifies the bypass per
    #      Constitution Principle II).
    #   3. Return {:ok, token, jti}.
    {:error, :not_implemented}
  end

  @doc """
  Verify an invitation-acceptance token.

  Returns `{:ok, invitation_id}` if the token is well-formed,
  unexpired, unrevoked, and carries `purpose == "invitation_accept"`;
  `{:error, :invalid_token}` otherwise.

  **Body lands in US1 T029.**
  """
  @spec verify(token()) :: {:ok, Ecto.UUID.t()} | {:error, :invalid_token}
  def verify(_token) do
    # Stub — real implementation in US1 T029:
    #   1. AshAuthentication.Jwt.verify/2 against GameNight.Accounts.User.
    #   2. Reject when claims["purpose"] != "invitation_accept".
    #   3. Check Token.revoked?/1 by JTI; reject if revoked.
    #   4. Parse claims["sub"] -> "invitation:<uuid>"; reject mismatched.
    #   5. Return {:ok, uuid}.
    {:error, :invalid_token}
  end
end

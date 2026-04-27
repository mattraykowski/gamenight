defmodule GameNight.Games.Invitation.Tokens do
  @moduledoc """
  Mint and verify per-invitation acceptance tokens.

  Tokens are JWTs minted via Joken using the AshAuthentication
  resource's signer + default-claims config (`GameNight.Accounts.User`)
  and persisted as rows on the existing `GameNight.Accounts.Token`
  table (purpose `"invitation_accept"`). Reusing the AshAuthentication
  token table gives us revocation, expiration, and the
  `expunge_expired` cron for free — see
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

  ### Why a custom `inv` claim instead of the JWT subject

  `AshAuthentication.Jwt.token_for_user/4` and
  `AshAuthentication.Jwt.token_for_resource/4` both overwrite the
  `"sub"` claim with their own user/resource subject string.
  Invitation IDs therefore cannot ride in `"sub"` via those helpers
  without forking AshAuthentication. Putting the invitation id in a
  custom `"inv"` claim sidesteps that and keeps the token's other
  claims (`iss`, `aud`, `exp`, `jti`) honestly emitted by
  `AshAuthentication.Jwt.Config`.
  """

  alias AshAuthentication.Jwt.Config, as: JwtConfig
  alias GameNight.Accounts.Token

  @auth_resource GameNight.Accounts.User
  @purpose "invitation_accept"

  @typedoc "Opaque JWT string carried in the email URL."
  @type token :: String.t()

  @typedoc "JWT identifier used for revocation."
  @type jti :: String.t()

  @doc """
  Mint a new invitation-acceptance token for `invitation`.

  Returns `{:ok, token, jti}` on success. The caller persists `jti`
  on the invitation row (`token_jti` attribute) so revocation has a
  stable handle.
  """
  @spec mint(GameNight.Games.Invitation.t() | %{id: Ecto.UUID.t()}) ::
          {:ok, token(), jti()} | {:error, term()}
  def mint(%{id: invitation_id}) do
    ttl_days = Application.fetch_env!(:game_night, :invitation_token_ttl_days)

    signer = JwtConfig.token_signer(@auth_resource, [], %{})
    default_claims = JwtConfig.default_claims(@auth_resource, token_lifetime: {ttl_days, :days})

    extra_claims = %{
      "inv" => invitation_id,
      "purpose" => @purpose,
      # Replace the AshAuthentication-default sub of "user?id=…" with
      # an invitation-scoped sub so any future code that reads `sub`
      # cannot mistake an invitation token for a user-auth token.
      "sub" => "invitation:#{invitation_id}"
    }

    with {:ok, token, claims} <- Joken.generate_and_sign(default_claims, extra_claims, signer),
         {:ok, _row} <- store_token_row(token) do
      {:ok, token, claims["jti"]}
    end
  end

  @doc """
  Verify an invitation-acceptance token.

  Returns `{:ok, invitation_id}` if the token is well-formed,
  unexpired, unrevoked, and carries `purpose == "invitation_accept"`;
  `{:error, :invalid_token}` otherwise.
  """
  @spec verify(token()) :: {:ok, Ecto.UUID.t()} | {:error, :invalid_token}
  def verify(token) when is_binary(token) do
    with {:ok, claims, _resource} <- AshAuthentication.Jwt.verify(token, @auth_resource),
         %{"purpose" => @purpose, "inv" => invitation_id, "jti" => jti} <- claims,
         false <- token_revoked?(jti) do
      {:ok, invitation_id}
    else
      _ -> {:error, :invalid_token}
    end
  end

  def verify(_), do: {:error, :invalid_token}

  # System-call: persist the freshly-minted JWT into
  # `GameNight.Accounts.Token` via the AshAuthentication-supplied
  # `:store_token` action. `authorize?: false` is justified per
  # Constitution Principle II — invitation token storage is an
  # internal-only path with no actor; the action's StoreTokenChange
  # is itself a privileged AshAuthentication-interaction.
  defp store_token_row(token) do
    Token
    |> Ash.Changeset.for_create(:store_token, %{
      token: token,
      purpose: @purpose
    })
    |> Ash.create(authorize?: false)
  end

  defp token_revoked?(jti) do
    case Token
         |> Ash.ActionInput.for_action(:revoked?, %{jti: jti, token: ""})
         |> Ash.run_action(authorize?: false) do
      {:ok, revoked?} when is_boolean(revoked?) -> revoked?
      # Any error from the revocation check fails closed.
      _ -> true
    end
  end
end

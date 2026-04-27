defmodule GameNight.Notifications.System do
  @moduledoc """
  Internal context for system-level Notification writes — the only
  sanctioned bypass of `GameNight.Notifications.Notification`'s
  deny-by-default policies (Constitution Principle II).

  Why a system context exists: notifications are created and resolved
  *as a side effect* of other domain actions (an invitation being
  created, accepted, declined, revoked). The acting user in those
  flows does **not** own the notification row that's being written —
  e.g. when GM Alice invites Bob, the notification is written **for
  Bob**, with Alice as the actor. Per-user policies on the actions
  would deny that write. Rather than weaken the policies, the
  notification-writing paths run with a marker actor whose presence
  is the documented exception.

  ### Policy posture

  - `Notification` declares
    `bypass action([:create_for_invitation, :resolve_for_subject])`
    that only triggers for the marker actor on those two actions.
  - Every other action (read, count_unread, mark_read) keeps its
    `expr(user_id == ^actor(:id))` clause, so an external caller
    who constructs the marker actor and tries to call those
    non-bypassed actions is still rejected (the marker has no
    `:id`, so `user_id == ^actor(:id)` fails closed). Tested in
    `test/game_night/notifications/system_test.exs`.

  This module is **not** routed; it has no JSON:API or RPC surface.
  Callers are other internal modules (e.g.
  `GameNight.Games.Invitation`) and tests.
  """

  alias GameNight.Accounts.User
  alias GameNight.Notifications.Notification

  require Ash.Query

  defmodule Actor do
    @moduledoc """
    Marker actor used by `GameNight.Notifications.System` to invoke
    notification writes that bypass the per-user `:read` policies.

    Construction is intentionally exposed (Elixir doesn't enforce
    module-private structs), but **no non-bypassed action ever
    admits this actor** — see `Notification`'s policies for the
    matching `bypass action([…])` clause and
    `test/game_night/notifications/system_test.exs` for the negative
    test that asserts external callers can't use the marker to read
    other users' rows.
    """
    defstruct _internal?: true

    @type t :: %__MODULE__{_internal?: boolean()}
  end

  @doc """
  Returns the marker actor used by this module's privileged calls.
  Exposed so callers (and tests) can pass it through to
  `Ash.create/2` etc. with `actor: GameNight.Notifications.System.actor()`.
  """
  @spec actor() :: Actor.t()
  def actor, do: %Actor{_internal?: true}

  @doc """
  Materialise an in-app notification for an invitation when the
  invited email matches an existing user account. No-op when no
  matching user exists — the email link is the recipient's only
  path in until they register.

  Idempotent: re-calling for the same `(user_id, subject_type,
  subject_id, kind)` returns the existing row (upsert via the
  resource's `:unique_user_subject_kind` identity).
  """
  @spec create_for_invitation(GameNight.Games.Invitation.t() | map()) :: :ok | {:error, term()}
  def create_for_invitation(invitation) do
    case find_user_by_email(invitation.email) do
      {:ok, user} ->
        Notification
        |> Ash.Changeset.for_create(
          :create_for_invitation,
          %{
            user_id: user.id,
            kind: :game_invitation,
            subject_type: "invitation",
            subject_id: invitation.id
          },
          actor: actor()
        )
        |> Ash.create()
        |> case do
          {:ok, _row} -> :ok
          {:error, reason} -> {:error, reason}
        end

      :no_match ->
        :ok
    end
  end

  @doc """
  Mark every notification matching `subject_type` + `subject_id` as
  resolved (`resolved_at` set to now). Called from
  `Invitation.accept_with_token`, `Invitation.decline_with_token`,
  and `Invitation.revoke` so the bell stops surfacing entries whose
  underlying subject has reached a terminal state.
  """
  @spec resolve_for_subject(String.t(), Ecto.UUID.t()) :: :ok | {:error, term()}
  def resolve_for_subject(subject_type, subject_id)
      when is_binary(subject_type) and is_binary(subject_id) do
    now = DateTime.utc_now()

    Notification
    |> Ash.Query.filter(
      subject_type == ^subject_type and subject_id == ^subject_id and is_nil(resolved_at)
    )
    # `authorize?: false` because this module IS the authorization
    # gate (Constitution Principle II — the bypass is documented at
    # the resource level and the system context is the only sanctioned
    # caller). Running the bulk_update under the marker actor would
    # also apply the implicit `:read` policy which scopes by
    # `user_id == ^actor(:id)` — but the marker has no `:id`, so the
    # read filter would collapse to `user_id = NULL` and match
    # nothing.
    |> Ash.bulk_update(:resolve_for_subject, %{resolved_at: now},
      authorize?: false,
      return_errors?: true
    )
    |> case do
      %Ash.BulkResult{status: :success} -> :ok
      %Ash.BulkResult{status: :empty} -> :ok
      %Ash.BulkResult{status: status, errors: errors} -> {:error, {status, errors}}
    end
  end

  defp find_user_by_email(email) do
    case User
         |> Ash.Query.for_read(:get_by_email, %{email: email})
         |> Ash.read_one(authorize?: false) do
      {:ok, %User{} = user} -> {:ok, user}
      {:ok, nil} -> :no_match
      {:error, _} -> :no_match
    end
  end
end

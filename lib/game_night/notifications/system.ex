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

  - The Notification resource declares `bypass actor_attribute_equals(:_internal?, true)`
    on the actions called from this module (`:create_for_invitation`,
    `:resolve_for_subject` — added in US2 T056/T057).
  - Every other action (read, count_unread, mark_read) keeps its
    `expr(user_id == ^actor(:id))` clause, so an external caller who
    constructs the marker actor and tries to call those non-bypassed
    actions is still rejected (defence in depth, tested in T051).

  This module is **not** routed; it has no JSON:API or RPC surface.
  Callers are other internal modules (e.g.
  `GameNight.Games.Invitation`) and tests.

  Function bodies are intentionally stubs — they land in US2
  (T056/T057). The signatures exist now so that
  `GameNight.Games.Invitation` (US1 T036) can wire the callback
  point in its `after_action` and have notifications materialise the
  moment the US2 work merges.
  """

  alias GameNight.Notifications.Notification

  defmodule Actor do
    @moduledoc """
    Marker actor used by `GameNight.Notifications.System` to invoke
    notification writes that bypass the per-user `:read` policies.

    Construction is intentionally exposed (Elixir doesn't enforce
    module-private structs), but **no non-bypassed action ever
    admits this actor** — see `Notification`'s policies for the
    matching `bypass actor_attribute_equals(:_internal?, true)`
    clauses, and `test/game_night/notifications/system_test.exs`
    for the negative test that asserts external callers can't use
    the marker to read other users' rows.
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
  invited email matches an existing user account.

  Idempotent: re-calling for the same `(user_id, subject_type,
  subject_id, kind)` returns the existing row (upsert via the
  resource's `:unique_user_subject_kind` identity).

  No-op when no user exists with the invited email — the email link
  is the recipient's only path in until they register.

  **Body lands in US2 T057**. For US1, this function is wired into
  `Invitation.create_for_game`'s `after_action` and is allowed to
  no-op. Callers should not rely on its return value beyond
  `:ok | {:error, term()}`.
  """
  @spec create_for_invitation(map()) :: :ok | {:error, term()}
  def create_for_invitation(_invitation) do
    # Stub — real implementation in US2 T057 looks up a user by email,
    # upserts a Notification with kind: :game_invitation, subject_type:
    # "invitation", subject_id: invitation.id under this module's
    # marker actor.
    _ = Notification
    :ok
  end

  @doc """
  Mark every notification matching `subject_type` + `subject_id` as
  resolved (`resolved_at` set to now). Called from
  `Invitation.accept_with_token`, `Invitation.decline_with_token`,
  and `Invitation.revoke` so the bell stops surfacing entries whose
  underlying subject has reached a terminal state.

  **Body lands in US2 T057**.
  """
  @spec resolve_for_subject(String.t(), Ecto.UUID.t()) :: :ok | {:error, term()}
  def resolve_for_subject(_subject_type, _subject_id) do
    # Stub — real implementation in US2 T057 runs an Ash bulk update
    # under this module's marker actor, filtering by subject_type and
    # subject_id and setting resolved_at: now().
    :ok
  end
end

defmodule GameNight.Notifications.Notification do
  @moduledoc """
  A polymorphic in-app notification entry shown to a single user.

  Today only one kind exists (`:game_invitation`); the schema is
  shaped so future kinds can land without migration churn — the
  `subject_type` (string) + `subject_id` (uuid) pair points at any
  resource without a hard FK.

  Skeleton resource for feature 002 (Invite Players) — declares the
  schema, the `belongs_to :user` relationship, the cascade-on-delete
  reference, and the composite index that drives the bell's
  unread-count query. Story phases add the named actions
  (`:list_mine`, `:count_unread`, `:mark_read`) and the system
  actions (`:create_for_invitation`, `:resolve_for_subject`) that
  the `GameNight.Notifications.System` context invokes.

  See `specs/002-invite-players/data-model.md` §Notification for the
  full attribute and policy tables.
  """
  use Ash.Resource,
    otp_app: :game_night,
    domain: GameNight.Notifications,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  @kinds [
    # Feature 002.
    :game_invitation,
    # Feature 003 — schedule lifecycle notifications.
    :schedule_ready_for_availability,
    :schedule_posted,
    :schedule_updated,
    :schedule_reminder
  ]

  def kinds, do: @kinds

  postgres do
    table "notifications"
    repo GameNight.Repo

    references do
      reference :user, on_delete: :delete
    end

    # Tells ash_postgres how to render the partial-index `where`
    # clause from `identity :unique_user_subject_kind`. Reminders
    # are repeatable (FR-038), so they're excluded from the unique
    # constraint at the DB level.
    identity_wheres_to_sql unique_user_subject_kind: "kind <> 'schedule_reminder'"

    custom_indexes do
      index [:user_id, :resolved_at, :inserted_at],
        name: "notifications_user_resolved_inserted_index"
    end
  end

  json_api do
    type "notification"

    routes do
      base "/notifications"

      # The actor's notifications, newest first.
      index :list_mine, route: "/"

      # Generic action — count of unread + unresolved notifications.
      route :get, "/unread-count", :count_unread

      # PATCH /:id — mark a single notification read.
      patch :mark_read
    end
  end

  typescript do
    type_name "Notification"
  end

  actions do
    defaults [:read]

    read :list_mine do
      description "The current user's notifications, newest first."

      prepare build(
                filter: expr(user_id == ^actor(:id)),
                sort: [inserted_at: :desc]
              )
    end

    action :count_unread, :integer do
      description """
      Count of the current user's unread + unresolved notifications.
      Drives the bell badge in the navbar.
      """

      run GameNight.Notifications.Notification.Actions.CountUnread
    end

    update :mark_read do
      description "Mark a single notification as read by the current user."
      accept []

      # `set_attribute(_, &fn/0)` requires non-atomic update mode —
      # Ash can't compile a 0-arity function into a SQL UPDATE
      # expression. The cost of going non-atomic for a single-row
      # mark-read is negligible.
      require_atomic? false
      change set_attribute(:read_at, &DateTime.utc_now/0)
    end

    create :create_for_invitation do
      description """
      System-only — invoked from `GameNight.Notifications.System` when
      `Invitation.create_for_game` runs and the invited email matches
      an existing user. Idempotent on the
      `:unique_user_subject_kind` identity.
      """

      accept [:user_id, :kind, :subject_type, :subject_id]

      upsert? true
      upsert_identity :unique_user_subject_kind
      upsert_fields []
    end

    create :create_unique do
      description """
      System-only — bypasses the `:unique_user_subject_kind` upsert
      and inserts a fresh row every call. Used for kinds where each
      call should materialise its own notification (e.g.
      `:schedule_reminder` per FR-038 — no rate limit, every
      reminder produces a new bell entry).
      """

      accept [:user_id, :kind, :subject_type, :subject_id]
    end

    update :resolve_for_subject do
      description """
      System-only — sets `resolved_at` to a caller-supplied
      timestamp. Invoked via `Ash.bulk_update/4` from the system
      context against a query filtering by `subject_type` +
      `subject_id`. Used when the underlying invitation transitions
      to a terminal state (accepted / declined / revoked).

      The caller passes `resolved_at` rather than the action calling
      `DateTime.utc_now/0` so the update can run atomically (a
      function-form `set_attribute` can't be compiled into the
      bulk SQL UPDATE).
      """

      accept [:resolved_at]
    end

    destroy :destroy_for_subject do
      description """
      System-only — hard-delete every notification whose
      `subject_type` + `subject_id` match the caller-supplied
      filter. Used when the underlying subject is itself being
      deleted (e.g. `Schedule.delete` in US8 — the polymorphic
      notification rows are not FK-cascaded).
      """
    end
  end

  policies do
    # System bypass — only for the two system actions. The marker
    # actor (`%GameNight.Notifications.System.Actor{_internal?: true}`)
    # is admitted for these specific actions only; any other action
    # falls through to the regular per-user policies, where the
    # marker actor (which has no `:id`) is rejected by
    # `user_id == ^actor(:id)`. That stack — narrow bypass + per-user
    # filter on every other action — is the defence-in-depth posture
    # required by Constitution Principle II.
    bypass action([
             :create_for_invitation,
             :create_unique,
             :resolve_for_subject,
             :destroy_for_subject
           ]) do
      authorize_if actor_attribute_equals(:_internal?, true)
    end

    policy action(:list_mine) do
      authorize_if expr(user_id == ^actor(:id))
    end

    # `:count_unread` is a generic action with no row to filter; the
    # action body scopes the query to the actor's own notifications,
    # so any authenticated caller passes the policy and reads only
    # their own count.
    policy action(:count_unread) do
      authorize_if actor_present()
    end

    policy action(:mark_read) do
      authorize_if expr(user_id == ^actor(:id))
    end

    # Base read for internal lookups (and the `:read` default action).
    # Owner-only.
    policy action_type(:read) do
      authorize_if expr(user_id == ^actor(:id))
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :kind, :atom do
      allow_nil? false
      public? true
      constraints one_of: @kinds
    end

    attribute :subject_type, :string do
      allow_nil? false
      public? true
      constraints min_length: 1, max_length: 64
    end

    attribute :subject_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :read_at, :utc_datetime_usec do
      allow_nil? true
      public? true
    end

    attribute :resolved_at, :utc_datetime_usec do
      allow_nil? true
      public? true
    end

    # Public so the SPA can render relative timestamps in the bell
    # dropdown and the /notifications list. Mirrors the Game
    # resource's posture.
    create_timestamp :inserted_at, public?: true
    update_timestamp :updated_at, public?: true
  end

  relationships do
    belongs_to :user, GameNight.Accounts.User do
      allow_nil? false
      public? false
      attribute_writable? true
    end
  end

  identities do
    # One notification per (user, subject_type, subject_id, kind),
    # EXCEPT for `:schedule_reminder` — reminders are explicitly
    # repeatable per FR-038 ("no rate limit; every click of Send
    # Reminder produces another bell entry"). The `where` clause
    # makes the unique index partial at the DB level so reminder
    # duplicates aren't blocked by Postgres.
    identity :unique_user_subject_kind, [:user_id, :subject_type, :subject_id, :kind] do
      where expr(kind != :schedule_reminder)
    end
  end
end

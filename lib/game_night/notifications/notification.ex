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

  @kinds [:game_invitation]

  def kinds, do: @kinds

  postgres do
    table "notifications"
    repo GameNight.Repo

    references do
      reference :user, on_delete: :delete
    end

    custom_indexes do
      index [:user_id, :resolved_at, :inserted_at],
        name: "notifications_user_resolved_inserted_index"
    end
  end

  typescript do
    type_name "Notification"
  end

  actions do
    defaults [:read]
  end

  policies do
    # Base `:read` policy — actor for own rows only. Story phases add
    # per-action policies for `:list_mine`, `:count_unread`,
    # `:mark_read`, plus a `bypass` clause for the system marker
    # actor used by `:create_for_invitation` and `:resolve_for_subject`.
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

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :user, GameNight.Accounts.User do
      allow_nil? false
      public? false
      attribute_writable? true
    end
  end

  identities do
    # One notification per (user, subject_type, subject_id, kind).
    # Lets `:create_for_invitation` use `upsert? true` semantics so
    # re-calls during retry / reconciliation are idempotent.
    identity :unique_user_subject_kind, [:user_id, :subject_type, :subject_id, :kind]
  end
end

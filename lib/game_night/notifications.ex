defmodule GameNight.Notifications do
  @moduledoc """
  Ash domain for the polymorphic in-app notifications surface.

  This domain hosts `GameNight.Notifications.Notification` and is
  designed from day one to grow beyond the single
  `:game_invitation` kind that ships with feature 002. The
  `GameNight.Notifications.System` internal context owns the
  privileged write paths (`:create_for_invitation`,
  `:resolve_for_subject`) and is the only sanctioned bypass of this
  domain's deny-by-default policies — see Constitution Principle II.

  Dual-exposed: every action surfaces on both JSON:API (canonical
  contract per Constitution Principle III) and the `ash_typescript`
  RPC channel (fast path for the SPA). Action and RPC bindings
  arrive in their owning user-story phases (US2 onwards).
  """
  use Ash.Domain,
    otp_app: :game_night,
    extensions: [AshJsonApi.Domain, AshTypescript.Rpc]

  # RPC bindings the SPA calls via `/rpc/run`.
  typescript_rpc do
    resource GameNight.Notifications.Notification do
      rpc_action :list_my_notifications, :list_mine
      rpc_action :count_my_unread, :count_unread
      rpc_action :mark_notification_read, :mark_read
    end
  end

  resources do
    resource GameNight.Notifications.Notification
  end
end

defmodule GameNight.Notifications.Notification.Actions.CountUnread do
  @moduledoc """
  Implementation of the `:count_unread` generic action on
  `GameNight.Notifications.Notification`. Returns the count of the
  current actor's notifications that are both unread (`read_at IS
  NULL`) and unresolved (`resolved_at IS NULL`) — the value the
  navbar bell badge renders.

  Uses `authorize?: false` for the underlying read because the
  action's policy already gates access (`actor_present()`); the
  `user_id == ^actor.id` filter is the data-scope and would
  otherwise be a redundant authorisation pass.
  """
  use Ash.Resource.Actions.Implementation

  alias GameNight.Notifications.Notification

  require Ash.Query

  @impl true
  def run(_input, _opts, context) do
    case context.actor do
      %{id: actor_id} when not is_nil(actor_id) ->
        Notification
        |> Ash.Query.filter(user_id == ^actor_id and is_nil(read_at) and is_nil(resolved_at))
        |> Ash.count(authorize?: false)

      _ ->
        {:ok, 0}
    end
  end
end

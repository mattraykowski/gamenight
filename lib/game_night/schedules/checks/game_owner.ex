defmodule GameNight.Schedules.Schedule.Checks.GameOwner do
  @moduledoc """
  Custom Ash policy check used by `Schedule.initiate`.

  Loads the target Game by `game_id` (from changeset attributes) and
  authorises the action when `game.owner_id == actor.id`.

  Why a custom check instead of the relationship-walk filter:
  Ash cannot evaluate `expr(game.owner_id == ^actor(:id))` on a
  *create* action because there is no row yet to walk
  relationships from. This check sidesteps that by reading the
  related Game directly under the privileged actor used by other
  internal lookups.
  """
  use Ash.Policy.SimpleCheck

  alias GameNight.Games.Game

  @impl true
  def describe(_opts), do: "the actor owns the target game"

  @impl true
  def match?(nil, _ctx, _opts), do: false

  def match?(actor, %{changeset: %Ash.Changeset{} = changeset}, _opts) do
    case Ash.Changeset.get_attribute(changeset, :game_id) do
      nil ->
        false

      game_id ->
        case Ash.get(Game, game_id, authorize?: false) do
          {:ok, %Game{owner_id: owner_id}} -> owner_id == Map.get(actor, :id)
          _ -> false
        end
    end
  end

  def match?(_actor, _ctx, _opts), do: false
end

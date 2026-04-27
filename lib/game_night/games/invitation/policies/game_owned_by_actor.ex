defmodule GameNight.Games.Invitation.Policies.GameOwnedByActor do
  @moduledoc """
  Policy check used by `Invitation.create_for_game` — true iff the
  current actor owns the game referenced by the `:game_id` argument.

  Bypasses the Game resource's read policy via `authorize?: false`
  because the policy itself is the authorization step; running the
  ownership query under the actor's policy would amount to circular
  authorization. The lookup is a narrow ownership-only check
  (`id == ^game_id and owner_id == ^actor.id`) and reads no fields
  beyond existence, so the bypass is justified per Constitution
  Principle II.
  """
  use Ash.Policy.SimpleCheck

  alias GameNight.Games.Game

  require Ash.Query

  @impl true
  def describe(_opts), do: "actor owns the game referenced by :game_id"

  @impl true
  def match?(nil, _context, _opts), do: false

  def match?(%{id: actor_id}, %{changeset: changeset}, _opts) when not is_nil(changeset) do
    case Ash.Changeset.get_argument(changeset, :game_id) do
      nil ->
        false

      game_id ->
        Game
        |> Ash.Query.filter(id == ^game_id and owner_id == ^actor_id)
        |> Ash.exists?(authorize?: false)
    end
  end

  def match?(_actor, _context, _opts), do: false
end

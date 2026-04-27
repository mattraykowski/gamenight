defmodule GameNight.Games.Invitation.Actions.DeclineInvitation do
  @moduledoc """
  Implementation of the `:decline_invitation` generic action — the
  JSON:API entry point for declining an invitation.

  Mirrors `AcceptInvitation` exactly except that the underlying
  update action is `:decline_with_token`, which does not create a
  Player record. See that module's docstring for the rationale on
  why the route uses a generic-action wrapper rather than calling
  the bare update action.
  """
  use Ash.Resource.Actions.Implementation

  alias GameNight.Games.Invitation

  @impl true
  def run(input, _opts, context) do
    actor = context.actor
    id = input.arguments.id
    token = input.arguments.token

    with %_{} = invitation <- Ash.get!(Invitation, id, authorize?: false),
         {:ok, declined} <-
           invitation
           |> Ash.Changeset.for_update(:decline_with_token, %{token: token}, actor: actor)
           |> Ash.update() do
      {:ok, %{id: declined.id, status: declined.status}}
    end
  end
end

defmodule GameNight.Accounts.User.Senders.SendPasswordResetEmail do
  @moduledoc """
  Sends a password reset email
  """

  use AshAuthentication.Sender
  use GameNightWeb, :verified_routes

  import Swoosh.Email

  alias GameNight.Mailer

  @impl true
  def send(user, token, _) do
    new()
    |> from({"GameNight", from_address()})
    |> to(to_string(user.email))
    |> subject("Reset your password")
    |> html_body(body(token: token))
    |> Mailer.deliver!()
  end

  defp body(params) do
    url = url(~p"/password-reset/#{params[:token]}")

    """
    <p>Click this link to reset your password:</p>
    <p><a href="#{url}">#{url}</a></p>
    """
  end

  defp from_address do
    Application.fetch_env!(:game_night, :transactional_email_from)
  end
end

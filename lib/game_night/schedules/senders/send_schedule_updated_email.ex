defmodule GameNight.Schedules.Senders.SendScheduleUpdatedEmail do
  @moduledoc """
  Sends the "schedule updated" email to a linked player when the
  GM clicks "Update and notify" on a posted schedule (US7).
  """
  use GameNightWeb, :verified_routes

  import Swoosh.Email

  alias GameNight.Mailer

  @spec send(
          GameNight.Schedules.ScheduleParticipant.t(),
          GameNight.Schedules.Schedule.t(),
          map()
        ) :: :ok | {:error, term()}
  def send(participant, _schedule, payload) do
    user = participant.player.user

    new()
    |> from({"Game Night", from_address()})
    |> to(to_string(user.email))
    |> subject(subject_for(payload))
    |> html_body(body(payload, participant))
    |> Mailer.deliver()
    |> case do
      {:ok, _} -> :ok
      other -> other
    end
  end

  defp subject_for(payload) do
    "#{payload["game_name"]} schedule for #{payload["schedule_name"]} was updated"
  end

  defp body(payload, participant) do
    character_url = url(~p"/characters/#{participant.player_id}")
    game_name = escape(payload["game_name"])
    schedule_name = escape(payload["schedule_name"])

    """
    <p>Hi,</p>
    <p>
      The schedule for <strong>#{game_name}</strong> &mdash;
      <em>#{schedule_name}</em> &mdash; has been updated. The GM
      adjusted the final days the game will run.
    </p>
    <p>
      <a href="#{character_url}">Open your character to view the latest</a>.
    </p>
    <p>Thanks,<br />Game Night</p>
    """
  end

  defp escape(value) do
    value
    |> to_string()
    |> Phoenix.HTML.html_escape()
    |> Phoenix.HTML.safe_to_string()
  end

  defp from_address do
    Application.fetch_env!(:game_night, :transactional_email_from)
  end
end

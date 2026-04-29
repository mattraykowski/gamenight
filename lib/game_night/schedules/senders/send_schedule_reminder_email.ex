defmodule GameNight.Schedules.Senders.SendScheduleReminderEmail do
  @moduledoc """
  Sends the "your GM is waiting on your availability" reminder
  email to a single participant. Triggered by
  `ScheduleParticipant.send_reminder` (US6).
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
    gm = payload["gm_display_name"] || "Your GM"
    schedule_name = payload["schedule_name"]
    "Reminder: #{gm} is waiting on your availability for #{schedule_name}"
  end

  defp body(payload, participant) do
    character_url = url(~p"/characters/#{participant.player_id}")
    game_name = escape(payload["game_name"])
    schedule_name = escape(payload["schedule_name"])
    gm = escape(payload["gm_display_name"] || "your GM")

    """
    <p>Hi,</p>
    <p>
      <strong>#{gm}</strong> is still waiting on your availability for
      <strong>#{game_name}</strong> &mdash; <em>#{schedule_name}</em>.
    </p>
    <p>
      <a href="#{character_url}">Open your character to set availability</a>.
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

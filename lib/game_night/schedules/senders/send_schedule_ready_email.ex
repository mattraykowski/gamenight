defmodule GameNight.Schedules.Senders.SendScheduleReadyEmail do
  @moduledoc """
  Sends the "schedule is ready for your availability" email to a
  linked player when a Schedule transitions to
  `:ready_for_availability`. Mirrors the shape of
  `GameNight.Games.Invitation.Senders.SendInvitationEmail`.

  HTML escaping per Sobelow: every interpolated attribute (game
  name, schedule name) goes through `Phoenix.HTML.html_escape/1`.
  """
  use GameNightWeb, :verified_routes

  import Swoosh.Email

  alias GameNight.Mailer

  @doc """
  Deliver the schedule-ready email to the participant. Called from
  `GameNight.Schedules.System.fan_out_notification/3`.
  """
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
    "#{payload["game_name"]} schedule for #{payload["schedule_name"]} is ready for your availability"
  end

  defp body(payload, participant) do
    character_url = url(~p"/characters/#{participant.player_id}")
    game_name = escape(payload["game_name"])
    schedule_name = escape(payload["schedule_name"])

    """
    <p>Hi,</p>
    <p>
      The schedule for <strong>#{game_name}</strong> &mdash;
      <em>#{schedule_name}</em> &mdash; is ready for you to mark
      your availability.
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

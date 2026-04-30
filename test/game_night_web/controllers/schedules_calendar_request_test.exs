defmodule GameNightWeb.SchedulesCalendarRequestTest do
  @moduledoc """
  T008 — JSON:API request test for the feature-004 calendar endpoint.

  Covers GET /api/schedules/calendar-events?year=YYYY&month=M, scoped
  to the authenticated actor.
  """
  use GameNightWeb.ConnCase, async: false

  alias AshAuthentication.Plug.Helpers, as: AuthPlugHelpers
  alias GameNight.Accounts.User
  alias GameNight.Games.{Game, Player}
  alias GameNight.Schedules.Schedule

  @jsonapi "application/vnd.api+json"

  describe "GET /api/schedules/calendar-events" do
    test "GM gets one row per Final-A day on their own posted schedule", %{conn: conn} do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, m1} = create_user()
      _ = seed_player!(game, m1)
      posted = build_posted_schedule!(gm, game, m1)

      conn =
        conn
        |> sign_in(gm)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/schedules/calendar-events?year=2099&month=10")

      assert [row | _] = Jason.decode!(conn.resp_body)

      assert row["date"] == "2099-10-05"
      assert row["schedule_id"] == posted.id
      assert row["game_id"] == game.id
      assert row["role"] == "gm"
      assert row["target_route"] == "/games/$gameId/schedules/$scheduleId"
    end

    test "anonymous request returns an empty list", %{conn: conn} do
      conn =
        conn
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/schedules/calendar-events?year=2099&month=10")

      assert [] == Jason.decode!(conn.resp_body)
    end

    test "non-owner / non-participant gets an empty list", %{conn: conn} do
      {:ok, gm} = create_user()
      {:ok, game} = register_game(gm)
      {:ok, m1} = create_user()
      _ = seed_player!(game, m1)
      _posted = build_posted_schedule!(gm, game, m1)

      {:ok, intruder} = create_user()

      conn =
        conn
        |> sign_in(intruder)
        |> put_req_header("accept", @jsonapi)
        |> get(~p"/api/schedules/calendar-events?year=2099&month=10")

      assert [] == Jason.decode!(conn.resp_body)
    end
  end

  defp build_posted_schedule!(gm, game, m1) do
    {:ok, schedule} =
      Schedule
      |> Ash.Changeset.for_create(
        :initiate,
        %{
          month: 10,
          year: 2099,
          start_time: ~T[19:00:00],
          end_time: ~T[23:00:00],
          time_zone: "America/Chicago",
          game_id: game.id
        },
        actor: gm
      )
      |> Ash.create()

    {:ok, schedule} =
      schedule
      |> Ash.Changeset.for_update(:set_gm_day, %{day: 5, status: :A}, actor: gm)
      |> Ash.update()

    {:ok, ready} =
      schedule
      |> Ash.Changeset.for_update(:transition_to_ready_for_availability, %{}, actor: gm)
      |> Ash.update()

    require Ash.Query

    [participant] =
      GameNight.Schedules.ScheduleParticipant
      |> Ash.Query.filter(schedule_id == ^ready.id and player.user_id == ^m1.id)
      |> Ash.read!(authorize?: false)

    day_5 =
      GameNight.Schedules.ParticipantDay
      |> Ash.Query.filter(participant_id == ^participant.id and day == 5)
      |> Ash.read_one!(authorize?: false)

    {:ok, _} =
      day_5
      |> Ash.Changeset.for_update(:set_status, %{status: :A}, actor: m1)
      |> Ash.update()

    {:ok, posted} =
      ready
      |> Ash.Changeset.for_update(:post, %{}, actor: gm)
      |> Ash.update()

    posted
  end

  defp create_user do
    email = "calendar-req-#{System.unique_integer([:positive])}@example.test"
    password = "calendar-req-password-1"

    User
    |> Ash.Changeset.for_create(:register_with_password, %{
      email: email,
      password: password,
      password_confirmation: password
    })
    |> Ash.create(authorize?: false)
  end

  defp register_game(owner) do
    Game
    |> Ash.Changeset.for_create(:register, %{title: "Calendar req test", status: :active},
      actor: owner
    )
    |> Ash.create()
  end

  defp seed_player!(game, user) do
    Player
    |> Ash.Changeset.for_create(:create, %{
      game_id: game.id,
      user_id: user.id,
      character_name: "Test Char",
      status: :active
    })
    |> Ash.create!(authorize?: false)
  end

  defp sign_in(conn, user) do
    conn
    |> Phoenix.ConnTest.init_test_session(%{})
    |> AuthPlugHelpers.store_in_session(user)
  end
end

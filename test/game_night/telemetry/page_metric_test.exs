defmodule GameNight.Telemetry.PageMetricTest do
  use GameNight.DataCase, async: true

  alias GameNight.Telemetry.PageMetric

  defp valid_input(overrides \\ %{}) do
    Map.merge(
      %{
        session_id: "session-#{System.unique_integer([:positive])}",
        route: "/dashboard",
        metric_name: :lcp,
        value: 1234.5,
        rating: :good,
        user_agent: "Mozilla/5.0 (Playwright)"
      },
      overrides
    )
  end

  describe ":record action" do
    test "stores a sample with correct attributes for an anonymous caller" do
      assert {:ok, %PageMetric{} = metric} =
               PageMetric
               |> Ash.Changeset.for_create(:record, valid_input())
               |> Ash.create(authorize?: false)

      assert metric.metric_name == :lcp
      assert metric.value == 1234.5
      assert metric.rating == :good
      assert metric.user_id == nil
      assert metric.inserted_at
    end

    test "attributes the sample to the acting user when one is present" do
      user = create_user!()

      assert {:ok, %PageMetric{} = metric} =
               PageMetric
               |> Ash.Changeset.for_create(:record, valid_input(), actor: user)
               |> Ash.create()

      assert metric.user_id == user.id
    end

    test "rejects invalid metric_name values" do
      assert {:error, %Ash.Error.Invalid{} = error} =
               PageMetric
               |> Ash.Changeset.for_create(:record, valid_input(%{metric_name: :bogus}))
               |> Ash.create(authorize?: false)

      assert error_on_field(error, :metric_name)
    end

    test "rejects invalid rating values" do
      assert {:error, %Ash.Error.Invalid{} = error} =
               PageMetric
               |> Ash.Changeset.for_create(:record, valid_input(%{rating: :excellent}))
               |> Ash.create(authorize?: false)

      assert error_on_field(error, :rating)
    end

    test "requires every non-nullable attribute" do
      assert {:error, %Ash.Error.Invalid{errors: errors}} =
               PageMetric
               |> Ash.Changeset.for_create(:record, %{})
               |> Ash.create(authorize?: false)

      required = [:session_id, :route, :metric_name, :value, :rating]

      for field <- required do
        assert Enum.any?(errors, fn
                 %{field: ^field} -> true
                 _ -> false
               end),
               "expected a missing-field error for #{field}, got: #{inspect(errors)}"
      end
    end
  end

  describe "policies" do
    test "anonymous (actor=nil) callers may create samples" do
      assert {:ok, _metric} =
               PageMetric
               |> Ash.Changeset.for_create(:record, valid_input())
               |> Ash.create(actor: nil)
    end

    test "authenticated callers may create samples" do
      user = create_user!()

      assert {:ok, _metric} =
               PageMetric
               |> Ash.Changeset.for_create(:record, valid_input())
               |> Ash.create(actor: user)
    end

    test "read/update/destroy actions are not exposed on the resource" do
      action_names =
        PageMetric
        |> Ash.Resource.Info.actions()
        |> Enum.map(& &1.name)

      assert action_names == [:record]
    end
  end

  defp create_user!, do: GameNight.AccountsFixtures.user_fixture()

  defp error_on_field(%Ash.Error.Invalid{errors: errors}, field) do
    Enum.any?(errors, fn
      %{field: ^field} -> true
      _ -> false
    end) || flunk("expected error on #{field}, got: #{inspect(errors)}")
  end
end

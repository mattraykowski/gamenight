defmodule GameNight.AccountsFixtures do
  @moduledoc """
  Reusable factory helpers for the `Accounts` domain in tests.
  """

  @default_password "test-password-1"

  def unique_email, do: "user-#{System.unique_integer([:positive])}@example.test"

  def user_fixture(attrs \\ %{}) do
    attrs =
      Enum.into(attrs, %{
        email: unique_email(),
        password: @default_password,
        password_confirmation: @default_password
      })

    GameNight.Accounts.User
    |> Ash.Changeset.for_create(:register_with_password, attrs)
    |> Ash.create!(authorize?: false)
  end
end

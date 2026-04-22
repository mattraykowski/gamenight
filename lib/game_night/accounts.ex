defmodule GameNight.Accounts do
  use Ash.Domain, otp_app: :game_night, extensions: [AshAdmin.Domain]

  admin do
    show? true
  end

  resources do
    resource GameNight.Accounts.Token
    resource GameNight.Accounts.User
  end
end

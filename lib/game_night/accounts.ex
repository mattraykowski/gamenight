defmodule GameNight.Accounts do
  use Ash.Domain, otp_app: :game_night, extensions: [AshAdmin.Domain, AshTypescript.Rpc]

  admin do
    show? true
  end

  typescript_rpc do
    resource GameNight.Accounts.User do
      rpc_action :read_current_user, :read_current_user
    end
  end

  resources do
    resource GameNight.Accounts.Token
    resource GameNight.Accounts.User
  end
end

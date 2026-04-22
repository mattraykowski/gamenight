defmodule GameNightWeb.AshTypescriptRpcController do
  use GameNightWeb, :controller

  def run(conn, params) do
    result = AshTypescript.Rpc.run_action(:game_night, conn, params)
    json(conn, result)
  end

  def validate(conn, params) do
    result = AshTypescript.Rpc.validate_action(:game_night, conn, params)
    json(conn, result)
  end
end

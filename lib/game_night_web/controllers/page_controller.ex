defmodule GameNightWeb.PageController do
  use GameNightWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end

  def index conn, _params do
    conn |> put_root_layout(html: {GameNightWeb.Layouts, :spa_root}) |> render(:index)
  end
end

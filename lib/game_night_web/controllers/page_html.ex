defmodule GameNightWeb.PageHTML do
  @moduledoc """
  This module contains pages rendered by PageController.

  See the `page_html` directory for all templates available.
  """
  use GameNightWeb, :html

  embed_templates "page_html/*"

  @doc """
  Serializes the SPA's auth state to JSON for embedding inside a
  `<script type="application/json">` island.

  Replaces the characters `<`, `>`, and `&` with their Unicode-escape
  forms so the serialized payload cannot end the surrounding `<script>`
  tag even if a user's email contains `</script>`.
  """
  def auth_state_json(auth_state) do
    auth_state
    |> Jason.encode!()
    |> String.replace("<", "\\u003c")
    |> String.replace(">", "\\u003e")
    |> String.replace("&", "\\u0026")
  end
end

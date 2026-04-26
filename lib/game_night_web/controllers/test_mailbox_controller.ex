defmodule GameNightWeb.TestMailboxController do
  @moduledoc """
  Playwright helper: exposes the in-memory dev-mailbox
  (`Swoosh.Adapters.Local.Storage.Memory`) as a JSON endpoint so E2E
  specs can capture a confirmation/reset/magic-link email and follow
  its token URL without scraping `/dev/mailbox` HTML.

  Mounted only when `:dev_routes` is enabled; the router excludes this
  endpoint from production. `GET` filters by recipient (the typical
  Playwright idiom: "wait for the email sent to <test-email>").
  `DELETE` clears the mailbox so specs do not pollute each other.
  """
  use GameNightWeb, :controller

  alias Swoosh.Adapters.Local.Storage.Memory

  def index(conn, params) do
    filter_to = normalize(params["to"])

    # `Memory.all/0` returns emails newest-first (the GenServer prepends
    # on push), so no reverse is needed before filtering.
    emails =
      Memory.all()
      |> Enum.filter(fn email -> filter_to == nil or recipient_match?(email, filter_to) end)
      |> Enum.map(&serialize_email/1)

    json(conn, %{emails: emails})
  end

  def clear(conn, _params) do
    Memory.delete_all()
    json(conn, %{ok: true})
  end

  defp serialize_email(%Swoosh.Email{} = email) do
    %{
      to: Enum.map(email.to, &format_mailbox/1),
      from: format_mailbox(email.from),
      subject: email.subject,
      text_body: email.text_body,
      html_body: email.html_body,
      inserted_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  defp format_mailbox(nil), do: nil

  defp format_mailbox({name, address}) when is_binary(name) and is_binary(address),
    do: %{name: name, address: address}

  defp format_mailbox(address) when is_binary(address), do: %{name: "", address: address}
  defp format_mailbox(_), do: nil

  defp recipient_match?(%Swoosh.Email{to: recipients}, target) do
    Enum.any?(recipients, fn
      {_name, address} when is_binary(address) -> String.downcase(address) == target
      address when is_binary(address) -> String.downcase(address) == target
      _ -> false
    end)
  end

  defp normalize(nil), do: nil
  defp normalize(""), do: nil
  defp normalize(value) when is_binary(value), do: value |> String.trim() |> String.downcase()
end

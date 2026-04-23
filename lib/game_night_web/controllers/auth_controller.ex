defmodule GameNightWeb.AuthController do
  use GameNightWeb, :controller
  use AshAuthentication.Phoenix.Controller

  @moduledoc """
  Authentication callbacks for `auth_routes`. Branches on the request
  `Accept` header: JSON requests (SPA fetch POSTs) receive structured
  JSON payloads; HTML requests (direct browser navigation, legacy
  bookmarks) fall back to a defensive redirect. The HTML branch is
  never hit by the SPA flow in steady state — every user-facing
  landing page is an SPA route that fetches with
  `Accept: application/json`.
  """

  @doc """
  Successful authentication callback.

  JSON mode returns `{user: {id, email}}` with a 200. Session storage
  happens here so the SPA can rely on the cookie being set by the time
  the response body arrives.

  HTML mode writes the session and redirects to `/`. No flash — the
  SPA shell does not render the flash layout.
  """
  def success(conn, _activity, user, _token) do
    conn = maybe_store_in_session(conn, user)

    case format(conn) do
      :json ->
        cond do
          user && Map.has_key?(user, :id) ->
            conn
            |> put_status(:ok)
            |> json(%{user: %{id: user.id, email: to_string(user.email)}})

          true ->
            # Request-style activities (e.g. `{:password, :reset_request}`,
            # `{:magic_link, :request}`) do not produce a user — the
            # action side-effect is sending an email and we intentionally
            # hide whether the address existed. Respond 200 with an empty
            # envelope so the SPA hook treats it as success.
            conn
            |> put_status(:ok)
            |> json(%{ok: true})
        end

      :html ->
        conn
        |> delete_session(:return_to)
        |> redirect(to: "/")
    end
  end

  defp maybe_store_in_session(conn, nil), do: conn
  defp maybe_store_in_session(conn, user), do: store_in_session(conn, user)

  @doc """
  Authentication failure callback.

  JSON mode maps the failure reason to the standard envelope
  `{errors: [{field, message, code}]}` with an appropriate status code.
  HTML mode redirects to the SPA sign-in page with a generic error
  marker.
  """
  def failure(conn, activity, reason) do
    case format(conn) do
      :json ->
        {status, errors} = json_failure(activity, reason)

        conn
        |> put_status(status)
        |> json(%{errors: errors})

      :html ->
        redirect(conn, to: "/sign-in?error=generic")
    end
  end

  @doc """
  Sign-out handler. Same accept-branch strategy as `success/4`:
  JSON clients get `{ok: true}`; HTML clients get the classic redirect.

  `clear_session/2` (imported from `AshAuthentication.Phoenix.Controller`)
  revokes bearer tokens, session tokens, and remember-me cookies in
  addition to clearing the Phoenix session.
  """
  def sign_out(conn, _params) do
    conn = clear_session(conn, :game_night)

    case format(conn) do
      :json ->
        conn
        |> put_status(:ok)
        |> json(%{ok: true})

      :html ->
        return_to = get_session(conn, :return_to) || ~p"/"
        redirect(conn, to: return_to)
    end
  end

  defp format(conn) do
    case Plug.Conn.get_req_header(conn, "accept") do
      ["application/json" <> _ | _] -> :json
      accepts when is_list(accepts) -> if any_json?(accepts), do: :json, else: :html
      _ -> :html
    end
  end

  defp any_json?(accepts) do
    Enum.any?(accepts, fn header ->
      header |> to_string() |> String.contains?("application/json")
    end)
  end

  # Translates the reason term returned by the authentication strategy
  # (usually an Ash error) into the SPA-facing envelope. Single point
  # of control so the SPA's form code never needs to know about Ash
  # internals.
  defp json_failure(_activity, %AshAuthentication.Errors.AuthenticationFailed{}) do
    {401,
     [
       %{
         field: nil,
         message: "Incorrect email or password",
         code: "invalid_credentials"
       }
     ]}
  end

  defp json_failure(_activity, %Ash.Error.Invalid{errors: errors}) when is_list(errors) do
    {422, Enum.map(errors, &ash_error_to_envelope/1)}
  end

  defp json_failure(_activity, %Ash.Error.Forbidden{}) do
    {403,
     [
       %{
         field: nil,
         message: "You are not authorised to perform this action.",
         code: "forbidden"
       }
     ]}
  end

  defp json_failure(_activity, reason) do
    message =
      case reason do
        binary when is_binary(binary) -> binary
        %{message: message} when is_binary(message) -> message
        _ -> "Unable to complete the request."
      end

    {422,
     [
       %{
         field: nil,
         message: message,
         code: "unknown"
       }
     ]}
  end

  defp ash_error_to_envelope(%{field: field, message: message} = err) do
    %{
      field: field && to_string(field),
      message: to_string(message || "is invalid"),
      code: derive_code(err)
    }
  end

  defp ash_error_to_envelope(%{fields: [field | _], message: message} = err) do
    %{
      field: to_string(field),
      message: to_string(message || "is invalid"),
      code: derive_code(err)
    }
  end

  defp ash_error_to_envelope(%{message: message} = err) do
    %{
      field: nil,
      message: to_string(message || "is invalid"),
      code: derive_code(err)
    }
  end

  defp ash_error_to_envelope(other) do
    %{field: nil, message: inspect(other), code: "unknown"}
  end

  defp derive_code(%{vars: %{code: code}}) when is_binary(code), do: code
  defp derive_code(%{vars: vars}) when is_list(vars), do: Keyword.get(vars, :code, "invalid")
  defp derive_code(%{type: type}) when is_atom(type), do: Atom.to_string(type)
  defp derive_code(_), do: "invalid"
end

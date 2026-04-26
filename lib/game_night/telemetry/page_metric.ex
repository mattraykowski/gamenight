defmodule GameNight.Telemetry.PageMetric do
  @moduledoc """
  One web-vitals sample (LCP, INP, CLS, TTFB, or FCP) emitted by the
  SPA for a specific route. Rows are append-only — there are no read,
  update, or destroy actions exposed here; access is through
  out-of-band reporting modules that query via `GameNight.Repo`
  directly (constitution Principle II's reporting exemption).
  """
  use Ash.Resource,
    otp_app: :game_night,
    domain: GameNight.Telemetry,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource]

  @metric_names [:lcp, :inp, :cls, :ttfb, :fcp]
  @ratings [:good, :needs_improvement, :poor]

  def metric_names, do: @metric_names
  def ratings, do: @ratings

  postgres do
    table "page_metrics"
    repo GameNight.Repo

    references do
      reference :user, on_delete: :nilify, on_update: :update
    end
  end

  json_api do
    type "page-metric"

    routes do
      base "/vitals"
      post :record
    end
  end

  actions do
    # Deliberately no :read/:update/:destroy — vitals are write-only
    # from the web boundary. Reporting modules that need to query these
    # rows drop to raw Ecto per the constitution's analytics exemption.
    create :record do
      description "Record a single web-vitals sample."
      accept [:session_id, :route, :metric_name, :value, :rating, :user_agent]

      # Associate with the current actor (if any) at write time — the
      # action accepts an anonymous payload, so we derive user_id from
      # the conn's actor rather than trusting a client-supplied id.
      change fn changeset, context ->
        case context.actor do
          %{id: id} -> Ash.Changeset.force_change_attribute(changeset, :user_id, id)
          _ -> changeset
        end
      end
    end
  end

  policies do
    # Reporting endpoint accepts writes from anonymous and authenticated
    # callers alike. Rate limiting at the HTTP layer (plug_attack on
    # `/api/vitals`) enforces volume caps per actor class — Ash policies
    # decide who *may* write, not how often.
    policy action(:record) do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :session_id, :string do
      allow_nil? false
      public? true
      constraints max_length: 64
    end

    attribute :route, :string do
      allow_nil? false
      public? true
      constraints max_length: 512
    end

    attribute :metric_name, :atom do
      allow_nil? false
      public? true
      constraints one_of: @metric_names
    end

    attribute :value, :float do
      allow_nil? false
      public? true
    end

    attribute :rating, :atom do
      allow_nil? false
      public? true
      constraints one_of: @ratings
    end

    attribute :user_agent, :string do
      allow_nil? true
      public? true
      constraints max_length: 512
    end

    create_timestamp :inserted_at
  end

  relationships do
    belongs_to :user, GameNight.Accounts.User do
      allow_nil? true
      public? true
    end
  end
end

# syntax=docker/dockerfile:1.7

# Versions pinned to the newest hexpm/elixir image that satisfies
# our floors. Our .tool-versions sits at Elixir 1.19.5 / OTP 28.4.2,
# but as of writing the hexpm/bob bot has only published up to
# 1.19.2 / OTP 28.1 on Docker Hub — so we float down to that here.
# The drift is patch-level only (bugfix releases). Bump these args
# once a newer hexpm/elixir snapshot is published.
ARG ELIXIR_VERSION=1.19.2
ARG OTP_VERSION=28.1
ARG DEBIAN_VERSION=bookworm-20251020-slim
ARG BUN_VERSION=1.3.12

ARG BUILDER_IMAGE="docker.io/hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}"
ARG RUNNER_IMAGE="docker.io/library/debian:${DEBIAN_VERSION}"

# ---------- Builder ----------
FROM ${BUILDER_IMAGE} AS builder

ARG BUN_VERSION

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends \
       build-essential git curl ca-certificates unzip \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

ENV MIX_ENV=prod \
    LANG=C.UTF-8 \
    BUN_INSTALL=/usr/local/bun \
    PATH=/usr/local/bun/bin:/root/.mix/escripts:${PATH}

# Install bun matching ./compile so `bun install --frozen-lockfile`
# resolves the same tree the production buildpack builds.
RUN curl -fsSL https://bun.sh/install | bash -s -- "bun-v${BUN_VERSION}" \
  && bun --version

WORKDIR /app

RUN mix local.hex --force && mix local.rebar --force

# Fetch and compile prod deps with just mix.exs/mix.lock + config so
# the dep layer caches independently of app source.
COPY mix.exs mix.lock ./
COPY config/config.exs config/prod.exs config/

RUN mix deps.get --only prod \
  && mix deps.compile

# App source — split copies so common edits don't bust the deps layer.
COPY priv priv
COPY lib lib
COPY assets assets

# Mirror ./compile: wipe whatever node_modules came along (npm-resolved
# or local dev artifacts) and reinstall with bun against bun.lock.
RUN cd assets && rm -rf node_modules && bun install --frozen-lockfile

# Compile the app first so phoenix_live_view's compiler writes the
# colocated stubs into _build/prod/phoenix-colocated/game_night/, then
# run assets.deploy via Mix so the :bun task sets MIX_BUILD_PATH for
# vite (see ./compile and assets/vite.config.ts).
RUN mix compile
RUN mix assets.deploy

# runtime.exs is read at boot, but copy it before the release so
# `mix release` bundles it into the tarball.
COPY config/runtime.exs config/
COPY rel rel

RUN mix release

# ---------- Runner ----------
FROM ${RUNNER_IMAGE} AS runner

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends \
       libstdc++6 openssl libncurses6 locales ca-certificates tini \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen \
  && locale-gen

ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8 \
    MIX_ENV=prod \
    PHX_SERVER=true \
    PORT=4000

WORKDIR /app

# Run as a non-root user; the BEAM doesn't need root and tzdata's
# release dir must be writable by the runtime user (it ships under
# the release's lib/tzdata-*/priv/ tree, which we chown below).
RUN groupadd --system --gid 1000 app \
  && useradd --system --uid 1000 --gid 1000 --home /app --shell /sbin/nologin app

COPY --from=builder --chown=app:app /app/_build/prod/rel/game_night ./

# Run pending migrations before booting the server. `bin/migrate`
# starts the repo, runs Ecto.Migrator, and stops cleanly — so it's
# safe to run on every container start (no-op if there's nothing
# pending). Toggle off with SKIP_MIGRATIONS=true for cases like
# running multiple replicas where only one should migrate.
RUN printf '%s\n' \
  '#!/bin/sh' \
  'set -eu' \
  'cd -P -- "$(dirname -- "$0")"' \
  'if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then' \
  '  echo "[entrypoint] running migrations"' \
  '  ./migrate' \
  'fi' \
  'exec ./server' \
  > /app/bin/docker-entrypoint \
  && chmod +x /app/bin/docker-entrypoint \
  && chown app:app /app/bin/docker-entrypoint

USER app

EXPOSE 4000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bin/docker-entrypoint"]

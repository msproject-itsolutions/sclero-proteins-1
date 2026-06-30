#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env. Copy .env.production.example to .env and fill it in." >&2
  exit 1
fi

if grep -Eq '(^|=)CHANGE_ME' .env; then
  echo ".env still contains CHANGE_ME placeholders." >&2
  exit 1
fi

for command in docker nginx curl; do
  command -v "$command" >/dev/null || {
    echo "Required command not found: $command" >&2
    exit 1
  }
done

docker compose config --quiet

port="$(grep -E '^SCLERO_HTTP_PORT=' .env | tail -1 | cut -d= -f2 || true)"
port="${port:-18088}"
if ss -ltnH "sport = :${port}" | grep -q .; then
  edge_id="$(docker compose ps -q edge 2>/dev/null || true)"
  if [[ -n "$edge_id" ]] &&
    docker port "$edge_id" 8080/tcp 2>/dev/null |
      grep -Eq "(127\\.0\\.0\\.1|\\[::1\\]):${port}$"; then
    echo "Loopback port ${port} is already owned by this Compose project."
  else
    echo "Loopback port ${port} is already in use by another process." >&2
    echo "Pick another SCLERO_HTTP_PORT before continuing." >&2
    exit 1
  fi
fi

echo "Preflight passed. Compose project and loopback port are available."

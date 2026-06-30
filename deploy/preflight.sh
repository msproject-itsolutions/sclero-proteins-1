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
  echo "Loopback port ${port} is already in use. Pick another SCLERO_HTTP_PORT." >&2
  exit 1
fi

echo "Preflight passed. Compose project and loopback port are available."

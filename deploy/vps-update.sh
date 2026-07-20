#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ -f .env ]] || die "Missing $repo_dir/.env"
[[ -z "$(git status --porcelain)" ]] ||
  die "Git checkout is dirty; commit or stash changes before updating"

for command in docker curl git; do
  command -v "$command" >/dev/null || die "Required command not found: $command"
done

./deploy/preflight.sh

previous_revision="$(git rev-parse HEAD)"
echo "==> Updating the checkout"
current_branch="$(git branch --show-current)"
[[ -n "$current_branch" ]] || die "Detached HEAD is not supported for automatic updates"
git pull --ff-only origin "$current_branch"

tag="$(git rev-parse --short=12 HEAD)"
echo "==> Running the repeatable production deployment"
if ! ./deploy/vps-install.sh --app-only; then
  echo "Update failed. Containers/logs follow:" >&2
  docker compose ps >&2 || true
  docker compose logs --tail=150 backend scheduler frontend edge db >&2 || true
  echo "Previous Git revision: ${previous_revision}" >&2
  echo "The database was not rolled back automatically." >&2
  exit 1
fi

docker compose ps
echo "Update complete: ${previous_revision:0:12} -> ${tag}"

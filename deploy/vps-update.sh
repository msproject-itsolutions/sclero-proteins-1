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

port="$(grep -E '^SCLERO_HTTP_PORT=' .env | tail -1 | cut -d= -f2- || true)"
port="${port:-18088}"
site_url="$(grep -E '^SITE_URL=' .env | tail -1 | cut -d= -f2- || true)"
primary_domain="${site_url#*://}"
primary_domain="${primary_domain%%/*}"
primary_domain="${primary_domain:-scleroproteins.co.uk}"

echo "==> Creating a pre-release backup"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sclero-proteins}" ./deploy/backup.sh

previous_revision="$(git rev-parse HEAD)"
echo "==> Updating the checkout"
git fetch origin --prune
git pull --ff-only

tag="$(git rev-parse --short=12 HEAD)"
if grep -q '^APP_IMAGE_TAG=' .env; then
  sed -i "s/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=${tag}/" .env
else
  printf '\nAPP_IMAGE_TAG=%s\n' "$tag" >> .env
fi

echo "==> Building and replacing application containers"
if ! docker compose build --pull ||
  ! docker compose up -d --wait ||
  ! curl -fsS -H "Host: ${primary_domain}" \
    "http://127.0.0.1:${port}/api/health/ready/" >/dev/null; then
  echo "Update failed. Containers/logs follow:" >&2
  docker compose ps >&2 || true
  docker compose logs --tail=150 backend frontend edge db >&2 || true
  echo "Previous Git revision: ${previous_revision}" >&2
  echo "The database was not rolled back automatically." >&2
  exit 1
fi

docker compose exec -T backend python manage.py check --deploy
docker compose ps
echo "Update complete: ${previous_revision:0:12} -> ${tag}"

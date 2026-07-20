#!/usr/bin/env bash
set -Eeuo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

usage() {
  cat <<'EOF'
Usage:
  ./deploy/restore.sh DATABASE.sql.gz MEDIA.tar.gz --confirm-replace

Restores a backup created by deploy/backup.sh into the current Compose project.
This replaces the current database schema and media volume. Run it only on the
new VPS stack before DNS cutover, or after taking a verified rollback backup.
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ $# -eq 3 ]] || { usage; exit 2; }
database_backup="$1"
media_backup="$2"
confirmation="$3"
[[ "$confirmation" == "--confirm-replace" ]] || die "Explicit --confirm-replace is required"
[[ -f "$database_backup" ]] || die "Database backup not found: $database_backup"
[[ -f "$media_backup" ]] || die "Media backup not found: $media_backup"
[[ -f .env ]] || die "Missing $repo_dir/.env"

for command in docker gzip tar; do
  command -v "$command" >/dev/null || die "Required command not found: $command"
done
docker compose config --quiet
gzip -t "$database_backup"
tar -tzf "$media_backup" >/dev/null

# Refuse archives containing absolute paths or parent traversal before piping
# data into the container-owned media volume.
if tar -tzf "$media_backup" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  die "Media archive contains an unsafe path"
fi

echo "Creating a rollback backup before restore..."
BACKUP_DIR="${BACKUP_DIR:-/var/backups/sclero-proteins}" ./deploy/backup.sh

echo "Restoring PostgreSQL..."
docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
gzip -dc "$database_backup" | docker compose exec -T db sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"'

echo "Restoring uploaded product, banner, and content media..."
docker compose exec -T backend sh -c \
  'find /app/media -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +'
gzip -dc "$media_backup" | docker compose exec -T backend tar -C /app/media -xf -

docker compose exec -T backend python manage.py migrate --noinput
docker compose restart backend scheduler
docker compose up -d --wait
docker compose exec -T backend python manage.py check --deploy
echo "Restore completed. Validate products, banners, checkout, email, and webhooks before DNS cutover."

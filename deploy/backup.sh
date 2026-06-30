#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

backup_dir="${BACKUP_DIR:-/var/backups/sclero-proteins}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
umask 077
mkdir -p "$backup_dir"

db_tmp="${backup_dir}/database-${timestamp}.sql.gz.tmp"
db_final="${backup_dir}/database-${timestamp}.sql.gz"
media_tmp="${backup_dir}/media-${timestamp}.tar.gz.tmp"
media_final="${backup_dir}/media-${timestamp}.tar.gz"

docker compose exec -T db sh -c \
  'pg_dump --no-owner --no-acl -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -9 > "$db_tmp"
mv "$db_tmp" "$db_final"

docker compose exec -T backend tar -C /app/media -czf - . > "$media_tmp"
mv "$media_tmp" "$media_final"

gzip -t "$db_final"
tar -tzf "$media_final" >/dev/null

find "$backup_dir" -maxdepth 1 -type f \
  \( -name 'database-*.sql.gz' -o -name 'media-*.tar.gz' \) \
  -mtime "+${retention_days}" -delete

echo "Backup completed: $db_final and $media_final"

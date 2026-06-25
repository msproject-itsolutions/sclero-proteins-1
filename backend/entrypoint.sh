#!/usr/bin/env sh
set -e

# Wait for Postgres to accept connections before migrating. DB_HOST/DB_PORT come
# from the environment (compose sets them to the db service).
if [ -n "$DB_HOST" ]; then
  echo "Waiting for database at $DB_HOST:${DB_PORT:-5432}..."
  i=0
  until python -c "import socket,sys,os; s=socket.socket(); s.settimeout(2); s.connect((os.environ['DB_HOST'], int(os.environ.get('DB_PORT','5432')))); s.close()" 2>/dev/null; do
    i=$((i+1))
    if [ "$i" -ge 30 ]; then
      echo "Database not reachable after 30 tries — continuing anyway."
      break
    fi
    sleep 2
  done
fi

echo "Applying database migrations..."
python manage.py migrate --noinput

# Re-run collectstatic at boot too, in case STATIC_ROOT is a runtime volume.
python manage.py collectstatic --noinput >/dev/null 2>&1 || true

exec "$@"

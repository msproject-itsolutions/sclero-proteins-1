#!/usr/bin/env sh
set -e

# Wait for Postgres before migrating. A production container must not continue
# with an unavailable database and enter a crash/restart loop after partial boot.
if [ -n "$DB_HOST" ]; then
  echo "Waiting for database at $DB_HOST:${DB_PORT:-5432}..."
  i=0
  until python -c "import socket,sys,os; s=socket.socket(); s.settimeout(2); s.connect((os.environ['DB_HOST'], int(os.environ.get('DB_PORT','5432')))); s.close()" 2>/dev/null; do
    i=$((i+1))
    if [ "$i" -ge 30 ]; then
      echo "Database not reachable after 30 tries." >&2
      exit 1
    fi
    sleep 2
  done
fi

echo "Applying database migrations..."
python manage.py migrate --noinput

# Re-run collectstatic at boot so a bad static manifest prevents an unhealthy
# release from being marked ready.
python manage.py collectstatic --noinput

exec "$@"

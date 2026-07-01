# Sclero Proteins — VPS Operator Card

Single-page ops sheet. Paste onto the VPS at `/opt/sclero-proteins/deploy/OPERATOR_CARD.md`. Every command runs from the repo root (`/opt/sclero-proteins`).

## 1. Facts

| Item | Value |
|---|---|
| Repo path | `/opt/sclero-proteins` |
| Compose project | `sclero-proteins` |
| Loopback port | `SCLERO_HTTP_PORT` in `.env` (default `18088`) |
| Public domains | scleroproteins.co.uk / .in / .com (+ `www.`) |
| Cert name | `scleroproteins.co.uk` (SAN covers all 6) |
| Cert path | `/etc/letsencrypt/live/scleroproteins.co.uk/` |
| Nginx site | `/etc/nginx/sites-available/scleroproteins.conf` |
| Backup dir | `/var/backups/sclero-proteins` |
| Backup cron | `/etc/cron.d/sclero-proteins-backup` (02:17 UTC daily) |
| Log file | `/var/log/sclero-proteins-backup.log` |

## 2. First-time deploy

```bash
sudo mkdir -p /opt/sclero-proteins && sudo chown "$USER":"$USER" /opt/sclero-proteins
cd /opt/sclero-proteins
git clone <REMOTE_URL> .
./deploy/vps-install.sh --email ops@scleroproteins.co.uk   # exits after creating .env
nano .env                                                  # fill every CHANGE_ME
./deploy/vps-install.sh --email ops@scleroproteins.co.uk   # full deploy
```

Add `--app-only` to bring the app up without touching host nginx / TLS.
Add `--skip-backup-cron` if you manage backups elsewhere.
Add `--primary-domain <host>` / `--domains a,b,c` to override defaults.

## 3. Rolling update

```bash
cd /opt/sclero-proteins
./deploy/vps-update.sh
```

Runs a pre-release backup, `git pull --ff-only`, rebuilds, replaces containers with `--wait`, smoke-tests. Prints `old_sha -> new_sha` on success. On failure it dumps container status + last 150 log lines and reports the previous revision (DB is not auto-rolled-back).

## 4. Health checks (from the VPS)

```bash
# Loopback (bypasses host nginx + TLS)
curl -sSf -H "Host: scleroproteins.co.uk" http://127.0.0.1:18088/api/health/ready/

# Public (through host nginx + TLS)
for d in scleroproteins.co.uk www.scleroproteins.co.uk \
         scleroproteins.in www.scleroproteins.in \
         scleroproteins.com www.scleroproteins.com; do
  printf '%-32s ' "$d"; curl -sSo /dev/null -w '%{http_code}\n' "https://$d/api/health/ready/"
done

docker compose ps
docker compose logs --tail=200 backend frontend edge db
```

## 5. Rollback

```bash
cd /opt/sclero-proteins
git log --oneline -20                              # find the last good SHA
git checkout <SHA>                                 # detached HEAD is fine
./deploy/vps-update.sh                             # rebuild at that SHA
```

If the failure is post-deploy DB-schema-related, restore the latest DB dump — see next section — before rebuilding at the old SHA.

## 6. Backup + restore

```bash
# Manual backup
BACKUP_DIR=/var/backups/sclero-proteins ./deploy/backup.sh

# List backups
ls -lh /var/backups/sclero-proteins/

# Restore DB (destructive — confirms via psql)
LATEST_DB=$(ls -1t /var/backups/sclero-proteins/database-*.sql.gz | head -1)
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
zcat "$LATEST_DB" | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# Restore media
LATEST_MEDIA=$(ls -1t /var/backups/sclero-proteins/media-*.tar.gz | head -1)
docker compose exec -T backend sh -c 'rm -rf /app/media/* && tar -C /app/media -xzf -' < "$LATEST_MEDIA"

# Re-run app checks after restore
docker compose restart backend frontend
curl -sSf -H "Host: scleroproteins.co.uk" http://127.0.0.1:18088/api/health/ready/
```

## 7. Certificate ops

```bash
# Renew (certbot systemd timer runs this automatically)
sudo certbot renew --dry-run
sudo certbot renew && sudo systemctl reload nginx

# Add a new hostname to the SAN cert (edit .env ALLOWED_HOSTS + CSRF_TRUSTED_ORIGINS first)
./deploy/vps-install.sh --email ops@scleroproteins.co.uk \
  --domains scleroproteins.co.uk,www.scleroproteins.co.uk,scleroproteins.in,www.scleroproteins.in,scleroproteins.com,www.scleroproteins.com,NEW_HOST
```

## 8. Common ops

```bash
# App shell
docker compose exec backend python manage.py shell
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py check --deploy

# Tail live logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart a single service
docker compose restart backend
docker compose up -d --wait --force-recreate backend

# Full stack cycle
docker compose down && docker compose up -d --wait

# Inspect resource use
docker stats --no-stream $(docker compose ps -q)
```

## 9. Known gotchas

- **Port already in use** — `preflight.sh` blocks install. Edit `SCLERO_HTTP_PORT` in `.env`, then re-run. Never publish 80/443 from this Compose file; the host nginx owns them.
- **Domain already in another nginx site** — installer refuses. Remove or rename the other site's `server_name` entries for Sclero hostnames, then re-run.
- **Dirty git checkout** — both install + update refuse. Commit or stash first. Do not `--force`.
- **HSTS creep** — `SECURE_HSTS_SECONDS=3600` for launch. Only raise after every hostname has served HTTPS cleanly for 24 h; adding `includeSubDomains` on a shared VPS can strand other projects.
- **Payments sandbox** — `ALLOW_SANDBOX_PAYMENTS=False` in prod. Keep it that way. Test flows in a staging tag with a separate `.env`.
- **Cloudflare + first cert** — if DNS is proxied (orange), first certbot HTTP-01 can still succeed via webroot; if it fails, set the record to "DNS only" (grey), run install, then re-proxy.

## 10. Uninstall (clean removal, does not touch other projects)

```bash
cd /opt/sclero-proteins
docker compose down -v                              # -v also drops named volumes (pgdata, media) — data loss
sudo rm -f /etc/nginx/sites-enabled/scleroproteins.conf /etc/nginx/sites-available/scleroproteins.conf
sudo nginx -t && sudo systemctl reload nginx
sudo rm -f /etc/cron.d/sclero-proteins-backup
sudo certbot delete --cert-name scleroproteins.co.uk   # optional
# /var/backups/sclero-proteins/ and /var/log/sclero-proteins-backup.log kept intentionally
```

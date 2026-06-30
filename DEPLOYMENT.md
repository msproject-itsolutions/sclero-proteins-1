# Sclero Proteins: shared-VPS deployment and operations guide

This runbook deploys Sclero Proteins beside existing live projects. It does not
claim public ports, replace the global nginx configuration, expose PostgreSQL,
or use globally named Docker resources.

## Architecture

```text
Internet
  -> existing host nginx (:80/:443, TLS and domain routing)
    -> 127.0.0.1:${SCLERO_HTTP_PORT:-18088}
      -> Sclero edge nginx (:8080 in Docker)
        -> Next.js (:3000, private)
        -> Django/Gunicorn (:8000, private)
        -> media volume (read-only at edge)
      -> PostgreSQL (:5432, private)
```

Compose scopes containers, networks, and volumes with
`COMPOSE_PROJECT_NAME=sclero-proteins`. Only the edge port is published, and it
is bound to loopback.

## Important payment limitation

COD is ready to use. Live Stripe, Razorpay, and PayPal capture/refund adapters
are not implemented. The backend now rejects unfinished live adapters and hides
test gateways in production, so an order cannot be falsely marked paid.

Do not enable online payment methods until provider-backed capture, refund,
amount/currency binding, idempotency, reconciliation, sandbox, and live tests
have been implemented. PayPal webhook verification itself is implemented and
fails closed.

## Automated installation

The safe one-command path is available after cloning the repository:

```bash
cd /opt/sclero-proteins
chmod +x deploy/*.sh
./deploy/vps-install.sh --email operations@example.com
```

On its first run, the installer creates `.env` with random Django and database
secrets and exits. Edit the remaining business, domain, and SMTP values, point
all configured DNS names to the VPS, then run the same command again.

The installer is idempotent and performs preflight checks, builds the images,
starts the isolated Compose project, runs migrations and deployment checks,
installs only the dedicated Sclero host-nginx site, obtains the SAN certificate,
validates nginx before reload, verifies HTTPS, and installs a daily backup job.
If host-nginx validation fails, it restores the previous Sclero site.

To start only the application stack without touching nginx or TLS:

```bash
./deploy/vps-install.sh --app-only
```

For later releases:

```bash
./deploy/vps-update.sh
```

The update script takes a database/media backup before pulling, rebuilds the
release, waits for health checks, and prints focused logs if deployment fails.
It never automatically reverses database migrations.

## 1. Inventory the shared host

Recommended baseline: Ubuntu 24.04 LTS, 4 GB RAM, 2 vCPU, Docker Engine with
Compose v2, existing host nginx, Certbot, and DNS access.

Before choosing a port or changing nginx:

```bash
sudo ss -ltnp
docker ps --format 'table {{.Names}}\t{{.Ports}}'
sudo nginx -T > /tmp/nginx-before-sclero.txt
sudo ufw status verbose
df -h
free -h
```

If `127.0.0.1:18088` is occupied, choose another high port. Use the same value
for `SCLERO_HTTP_PORT`, the host nginx upstream, and the temporary bootstrap
config.

The host firewall should expose only SSH, HTTP, and HTTPS. Never expose the
Sclero loopback port, Django, Next.js, or PostgreSQL.

## 2. Install the release

```bash
sudo install -d -o "$USER" -g "$USER" /opt/sclero-proteins
git clone <repository-url> /opt/sclero-proteins
cd /opt/sclero-proteins
cp .env.production.example .env
chmod 600 .env
```

Generate separate application and database secrets:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(64))'
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

Replace every `CHANGE_ME` in `.env`. At minimum configure:

- `SECRET_KEY`
- matching `POSTGRES_PASSWORD` and `DB_PASSWORD`
- all public hosts and CSRF origins
- `SITE_URL` and `NEXT_PUBLIC_SITE_URL`
- company registration, VAT, and GST identifiers approved by finance/legal
- SMTP and sender settings
- optional Google, analytics, Trustpilot, Sentry, and webhook credentials

Never commit `.env`, reuse another project's secrets, paste it into tickets, or
pass server secrets as Docker build arguments.

Validate the first deployment:

```bash
chmod +x deploy/preflight.sh deploy/backup.sh
./deploy/preflight.sh
export APP_IMAGE_TAG="$(git rev-parse --short HEAD)"
sed -i "s/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=${APP_IMAGE_TAG}/" .env
docker compose build --pull
docker compose up -d --wait
docker compose ps
curl -fsS -H 'Host: scleroproteins.co.uk' \
  http://127.0.0.1:18088/api/health/ready/
```

Do not touch public nginx until the loopback health request succeeds.

## 3. DNS, first certificate, and host nginx

Point these names to the VPS:

```text
scleroproteins.co.uk       www.scleroproteins.co.uk
scleroproteins.in          www.scleroproteins.in
scleroproteins.com         www.scleroproteins.com
```

If Cloudflare proxying is enabled, use a DNS challenge or temporarily switch to
DNS-only for the first HTTP-01 certificate.

Install the HTTP-only bootstrap site:

```bash
sudo install -d /var/www/letsencrypt
sudo cp deploy/nginx/scleroproteins-bootstrap.conf \
  /etc/nginx/sites-available/scleroproteins.conf
sudo ln -sfn /etc/nginx/sites-available/scleroproteins.conf \
  /etc/nginx/sites-enabled/scleroproteins.conf
sudo nginx -t
sudo systemctl reload nginx
```

Issue one SAN certificate:

```bash
sudo certbot certonly --webroot -w /var/www/letsencrypt \
  --cert-name scleroproteins.co.uk \
  -d scleroproteins.co.uk -d www.scleroproteins.co.uk \
  -d scleroproteins.in -d www.scleroproteins.in \
  -d scleroproteins.com -d www.scleroproteins.com
```

Install the final site only after the certificate exists:

```bash
sudo cp deploy/nginx/scleroproteins-host.conf \
  /etc/nginx/sites-available/scleroproteins.conf
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

Always test before reload. Never replace `/etc/nginx/nginx.conf` or another
project's site file.

### Cloudflare real client IPs

If Cloudflare is used, configure nginx's real-IP module with only Cloudflare's
published IP ranges and `real_ip_header CF-Connecting-IP`. Keep the host
template's replacement—not appending—of `X-Forwarded-For`. This is required for
accurate rate limiting, audit trails, fraud signals, and staff IP restrictions.

## 4. Migrations and first admin

The backend entrypoint waits for PostgreSQL, migrates, and collects static
assets. A failure stops the container.

```bash
docker compose exec backend python manage.py check --deploy
docker compose exec backend python manage.py showmigrations
docker compose exec backend python manage.py makemigrations --check --dry-run
```

Pass bootstrap passwords only to one-off commands:

```bash
read -rsp 'Initial superuser password: ' SEED_SUPERUSER_PASSWORD; echo
read -rsp 'Initial staff password: ' SEED_STAFF_PASSWORD; echo

docker compose exec \
  -e SEED_SUPERUSER_PASSWORD="$SEED_SUPERUSER_PASSWORD" \
  backend python manage.py seed_db
docker compose exec \
  -e SEED_STAFF_PASSWORD="$SEED_STAFF_PASSWORD" \
  backend python manage.py seed_rbac

unset SEED_SUPERUSER_PASSWORD SEED_STAFF_PASSWORD
docker compose exec backend python manage.py seed_email_templates
docker compose exec backend python manage.py seed_catalog
```

Immediately rotate bootstrap credentials, enable TOTP for every staff account,
and verify least-privilege roles.

## 5. Release verification

```bash
curl -fsS https://scleroproteins.co.uk/api/health/live/
curl -fsS https://scleroproteins.co.uk/api/health/ready/
curl -I https://scleroproteins.co.uk/
curl -I https://scleroproteins.in/
curl -I https://scleroproteins.com/
curl -fsS https://scleroproteins.co.uk/api/regions/
docker compose ps
docker compose logs --tail=200 backend frontend edge db
```

Manually test:

- catalog, products, cart, and both regional price/tax paths
- registration, password login, email OTP, magic link, reset, refresh, and TOTP
- anonymous denial on an admin API and restricted staff RBAC
- upload followed by public media rendering
- SMTP delivery plus SPF, DKIM, and DMARC
- COD checkout, invoice, and confirmation email
- mobile navigation and browser console/network errors

Business owners must approve addresses, phone numbers, product/certification
claims, tax identifiers, shipping/returns, privacy/cookie wording, and social
profiles before DNS cutover.

## 6. Backups and restore drills

```bash
sudo install -d -m 700 -o "$USER" -g "$USER" /var/backups/sclero-proteins
BACKUP_DIR=/var/backups/sclero-proteins ./deploy/backup.sh
```

Cron example:

```cron
17 2 * * * cd /opt/sclero-proteins && BACKUP_DIR=/var/backups/sclero-proteins ./deploy/backup.sh >> /var/log/sclero-backup.log 2>&1
```

Copy encrypted backups off the VPS. A backup on the same disk is not disaster
recovery.

Restore into a drill environment first:

```bash
gunzip -c database-YYYYMMDDTHHMMSSZ.sql.gz \
  | docker compose exec -T db sh -c \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T backend tar -C /app/media -xzf - \
  < media-YYYYMMDDTHHMMSSZ.tar.gz
```

A production restore is destructive: stop edge/frontend/backend, recreate or
clean the database deliberately, restore, migrate, start, and verify.

## 7. Updates and rollback

```bash
cd /opt/sclero-proteins
BACKUP_DIR=/var/backups/sclero-proteins ./deploy/backup.sh
git fetch --all --prune
git pull --ff-only
export APP_IMAGE_TAG="$(git rev-parse --short HEAD)"
sed -i "s/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=${APP_IMAGE_TAG}/" .env
docker compose build --pull
docker compose up -d --wait
curl -fsS https://scleroproteins.co.uk/api/health/ready/
```

This single-stack update may cause a short interruption. For strict zero
downtime, launch a second Compose project on a second loopback port, migrate
once, validate with Host headers, switch the host nginx upstream, and retire the
old project.

For application rollback, restore the prior Git revision and image tag, then
run `docker compose up -d --wait`. Never reverse a database migration blindly;
use a forward fix or a tested restore.

## 8. Shared-host operations

```bash
docker stats
docker system df
docker compose logs -f --tail=200 backend frontend edge
docker compose exec backend python manage.py check
df -h
free -h
journalctl -u nginx --since today
```

Monitor public liveness/readiness, HTTP 5xx, Sentry/error volume, container
restarts, disk, certificate expiry, and backup freshness. Resource and log caps
are configurable in `.env`.

Never run broad `docker system prune -a`, delete global nginx files, or operate
on ambiguous container/volume names on a shared VPS.

## Go-live checklist

- [ ] `.env` is mode 600, uncommitted, and has no placeholders
- [ ] loopback port and Compose project name are unique
- [ ] `docker compose up -d --wait` succeeds
- [ ] migrations and Django deploy checks pass
- [ ] npm and Python audits have no known high/critical findings
- [ ] host `nginx -t` and Certbot dry-run pass
- [ ] all six names have correct TLS and redirect behavior
- [ ] SMTP and domain authentication are verified
- [ ] staff TOTP, RBAC, and IP restrictions are verified
- [ ] COD works and unfinished online gateways remain disabled
- [ ] off-host backup and restore drill are complete
- [ ] operational monitoring and alerts are active
- [ ] legal, tax, product, and privacy content is approved

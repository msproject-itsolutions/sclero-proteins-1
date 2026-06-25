# Sclero Proteins — VPS Deployment Guide

This deploys the whole stack (Postgres + Django/gunicorn + Next.js + nginx/TLS)
to a single Linux VPS with Docker Compose, serving three domains:

| Domain                     | Role                                                        |
| -------------------------- | ----------------------------------------------------------- |
| `scleroproteins.co.uk`     | UK store — GBP / VAT. Default for the UK and rest of world. |
| `scleroproteins.in`        | India store — INR / GST.                                    |
| `scleroproteins.com`       | Geo-router — forwards visitors to `.in` (India) or `.co.uk`.|

**How the regional redirect works.** A visitor's country comes from an edge
header (`CF-IPCountry`). The Next.js middleware ([frontend/middleware.js](frontend/middleware.js)) then:

- on `.com` → redirects to `.in` for India, `.co.uk` for everyone else;
- on `.co.uk` → redirects Indian visitors to `.in`;
- on `.in` → redirects non-Indian visitors to `.co.uk`;
- a shopper who picks a region with the on-site switcher is sent to that domain
  with `?set_region=…`, which drops a cookie so they're never bounced again.

> **The country header requires an edge that injects it.** The simplest is
> **Cloudflare** (free): proxy your DNS (orange cloud) and `CF-IPCountry` appears
> automatically. Without Cloudflare, country is unknown and `.com` just sends
> everyone to `.co.uk`; to get geo without Cloudflare, install nginx's GeoIP2
> module or set `MAXMIND_DB_PATH` (the backend supports it — see
> [backend/apps/regions/geo.py](backend/apps/regions/geo.py)).

---

## 1. Provision the VPS

- Ubuntu 22.04/24.04 LTS, 2 vCPU / 4 GB RAM minimum (Hetzner, DigitalOcean,
  Contabo, Linode, etc.).
- Open ports **22, 80, 443** in the provider firewall / `ufw`.

Install Docker + Compose plugin:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER       # log out/in afterwards
docker compose version              # confirm the plugin is present
```

## 2. DNS

Point an **A record** (and AAAA if you have IPv6) for each of these at the VPS IP:

```
scleroproteins.co.uk        www.scleroproteins.co.uk
scleroproteins.in           www.scleroproteins.in
scleroproteins.com          www.scleroproteins.com
```

If using Cloudflare, you may keep the proxy **off (grey cloud)** while issuing
the first certificate (step 5), then turn it **on (orange cloud)** and set SSL
mode to **Full (strict)**. (Or use a Cloudflare Origin Certificate instead of
Let's Encrypt — then skip step 5.)

## 3. Get the code + configure

```bash
git clone <your-repo-url> sclero && cd sclero
cp .env.production.example .env
nano .env        # fill every CHANGE_ME (SECRET_KEY, DB password, seed passwords,
                 # payment keys, SMTP, LETSENCRYPT_EMAIL)
```

Generate a secret key:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
```

## 4. Build the images

```bash
docker compose build
```

## 5. Issue the TLS certificate (one time)

DNS must already resolve to the VPS. This issues a single certificate covering
all six names:

```bash
chmod +x deploy/init-letsencrypt.sh
LETSENCRYPT_EMAIL="you@example.com" ./deploy/init-letsencrypt.sh
# Test first against the LE staging CA to avoid rate limits:
#   STAGING=1 ./deploy/init-letsencrypt.sh
```

## 6. Start everything

```bash
docker compose up -d
docker compose ps          # all services healthy/running
docker compose logs -f backend
```

The backend entrypoint waits for Postgres and runs `migrate` automatically.

## 7. Seed data (first deploy only)

```bash
# Regions (IN/UK), admin user, payment gateways:
docker compose exec backend python manage.py seed_db
# Product catalogue:
docker compose exec backend python manage.py seed_catalog
# (other seeders as needed: seed_rbac, seed_email_templates, seed_payment_gateways)
```

Seed passwords come from `SEED_SUPERUSER_PASSWORD` / `SEED_STAFF_PASSWORD` in
`.env` (required because `DEBUG=False`).

## 8. Verify

```bash
curl -I https://scleroproteins.co.uk            # 200, valid cert
curl -I https://scleroproteins.in               # 200
# Geo redirect (needs Cloudflare/edge country header):
curl -I -H "CF-IPCountry: IN" https://scleroproteins.com   # 307 -> https://scleroproteins.in/
curl -I -H "CF-IPCountry: GB" https://scleroproteins.com   # 307 -> https://scleroproteins.co.uk/
curl -I -H "CF-IPCountry: IN" https://scleroproteins.co.uk # 307 -> https://scleroproteins.in/
```

---

## Day-2 operations

```bash
# Update to a new release
git pull && docker compose build && docker compose up -d

# Logs
docker compose logs -f nginx backend frontend

# Database backup
docker compose exec db pg_dump -U "$DB_USER" "$DB_NAME" > backup_$(date +%F).sql

# Manual cert renewal (certbot also auto-renews twice daily)
docker compose run --rm certbot renew --webroot -w /var/www/certbot
docker compose exec nginx nginx -s reload
```

## Notes & limitations

- **Each ccTLD is its own first-party origin**, so the cart and login session do
  not carry across `.co.uk` ↔ `.in`. Switching region intentionally clears the
  cart (the UI already warns about this).
- **API is same-origin**: the browser calls `/api/...` on whichever domain it is
  on and nginx proxies to Django, so there are no CORS or third-party-cookie
  issues. `NEXT_PUBLIC_API_URL` is intentionally left empty in production.
- **Static vs media**: Django's own static (admin/DRF) is served by WhiteNoise
  inside the app; user-uploaded `/media` is served by nginx from a shared volume.
- For zero-downtime DB upgrades or multi-node scaling, move Postgres to a managed
  service and point `DB_HOST` at it.

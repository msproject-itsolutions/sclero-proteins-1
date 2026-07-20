# Sclero Proteins commerce platform

Sclero Proteins is a multi-region e-commerce storefront and administration suite. It combines a Next.js customer experience with a Django REST API, PostgreSQL, background scheduling, regional inventory, configurable tax and shipping, payment-provider integrations, content management, staff permissions, and audit records.

This repository is a production release candidate. Before public launch, complete the external acceptance checks in [Production release gate](#production-release-gate), including real PostgreSQL, Docker, TLS, SMTP, payment sandboxes, webhook delivery, and backup restoration.

## Main capabilities

- Multi-region markets, currencies, tax rates, company details, warehouses, and stock.
- Product catalog, variants, media, bundles, categories, reviews, wishlists, and regional pricing.
- Shipping zones with country/state/city/postcode matching and flat, order-value, weight, quantity, free, and custom rates.
- Rate-level handling fees, free-shipping thresholds, remote-postcode surcharges, delivery estimates, priority, and active status.
- Cart, checkout, coupons, invoices, refunds, payment capture, and order administration.
- Variant-aware cart lines, regional variant pricing, weight calculation, stock enforcement, and immutable order/invoice option snapshots.
- Stripe and Razorpay collection paths, PayPal webhook verification, and cash on delivery. See the gateway limitations below.
- Durable incoming and outgoing webhooks with signatures, idempotency, retries, destination validation, and a dead-letter state.
- Admin-managed homepage, banners, navigation, footer, branding, pages, blog, email templates, cookies, analytics, and SEO settings.
- Staff roles, granular permissions, TOTP, IP restrictions, approval requests, and audit logs.
- Durable transactional-email retries, scheduled inbox sync, abandoned-cart reminders, review requests, and webhook processing.
- Checkout follow-up isolation: invoice rendering, email, and fraud-service failures cannot roll back a payment-confirmed order.
- Browser push campaigns with subscription renewal, retry handling, and scheduler delivery.
- Automated pull-request checks for migrations, backend tests, dependency audit, frontend production build, and Compose validation.

## Architecture

```text
Browser
  -> host nginx / TLS
    -> edge nginx container
      -> Next.js frontend
      -> Django REST API
           -> PostgreSQL
           -> persistent media volume
           -> scheduler process
           -> payment, SMTP, IMAP, geo-IP and webhook services
```

The production Compose stack publishes only a loopback edge port. Host nginx owns ports 80/443 and proxies the configured domains to that port. PostgreSQL is isolated on an internal network.

## Requirements

- Python 3.12
- Node.js 24 LTS and npm
- PostgreSQL 16 for integration and production use
- Docker Engine with Compose v2 for the supported production deployment
- Linux host nginx and Certbot for the included shared-VPS workflow

SQLite is permitted only for local development when `DEBUG=True`. Production refuses the SQLite fallback.

## Local installation

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

On Linux/macOS, activate with `source .venv/bin/activate` and copy with `cp`.

If PostgreSQL credentials are not configured, a debug run uses `backend/db.sqlite3`. To test production behavior, use PostgreSQL and set `ALLOW_SQLITE_FALLBACK=False`.

### Frontend

```powershell
cd frontend
npm ci
Copy-Item .env.example .env.local
npm run dev
```

The storefront is available at `http://localhost:3000`; the API defaults to `http://localhost:8000` when `NEXT_PUBLIC_API_URL` is set accordingly.

## Environment and secrets

- Local backend template: `backend/.env.example`
- Local frontend template: `frontend/.env.example`
- Production Compose template: `.env.production.example`

Never commit an active `.env`, private key, database dump, mailbox password, gateway secret, or webhook signing secret. Generate `SECRET_KEY` with a cryptographically secure generator. All `CHANGE_ME` values in the production template are release blockers; the VPS installer replaces the specifically marked generated VAPID value itself.

Important groups:

| Group | Examples | Notes |
| --- | --- | --- |
| Django | `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `SITE_URL` | `DEBUG=False` in production |
| Database | `DB_*`, `POSTGRES_*` | Password pairs must match |
| Security | `RBAC_ENFORCED`, `AUTH_COOKIE_MODE`, `TRUST_PROXY_HEADERS`, `SECURE_HSTS_*` | Keep RBAC and HttpOnly cookie sessions enabled |
| Payments | Stripe, Razorpay and PayPal credentials/webhook values | Prefer admin gateway records; environment values are server-side fallbacks |
| Email | `EMAIL_*`, `IMAP_*`, `SCHEDULE_EMAIL_RETRY_SECONDS` | Failed transactional sends are queued and retried; mail sync is disabled by missing credentials and fails visibly |
| Web Push | `VAPID_*`, `SCHEDULE_PUSH_SECONDS` | VPS installer generates the signing key; private key is never committed |
| Frontend build | `NEXT_PUBLIC_*`, `CSP_REPORT_ONLY` | Values are compiled into the browser bundle; never place secrets here |
| Operations | resource limits, scheduler intervals, Sentry | Tune after observing real traffic |

## Admin configuration

Open `http://localhost:3000/admin` and sign in as authorized staff. Direct links are supported for key areas.

### Shipping

Open `http://localhost:3000/admin?section=settings&tab=shipping`.

1. Create or enable a Market under **Settings → Markets** and assign its countries.
2. Open **Settings → Shipping & Delivery** and select **Add shipping zone**.
3. Choose the region and destination countries, then optionally narrow by states, cities, or postcode ranges.
4. Select **Add rate** and configure flat, order-price, cart-weight, item-quantity, free, or custom rules.
5. Configure handling fee, free-above threshold, remote postcodes and surcharge, estimated delivery text, checkout priority, description, and active status.
6. Save and test a checkout address inside and outside the zone.

Checkout deliberately fails closed when no active matching zone/rate exists; it no longer invents a default shipping charge. Product weight must be maintained for weight-based rules.

When a product has variants, the selected option is preserved as a distinct cart line. Variant price, option-derived weight, and stock are revalidated on the server at checkout; retired options fail with a customer-safe instruction instead of silently falling back to the base product.

### Other business settings

- **Products**: catalog data, current product images, regional prices, stock and visibility.
- **Payments**: gateway credentials, mode, region, order, active status, fraud rules, and role/region refund limits.
- **Settings → Markets**: currencies, tax rate, countries, company address/contact and tax identifiers.
- **Settings → Tax / Checkout**: inclusive or exclusive tax and checkout behavior.
- **Content / Online store**: homepage, hero slides, vertical text alignment, navigation-arrow placement, pages, blog, menus, footer, branding, cookie settings and SEO.
- **Settings → Emails**: transactional templates and test delivery.
- **Settings → Push notifications**: create, schedule, monitor and cancel browser push campaigns. Customers opt in or out from the storefront footer.
- **Security audit**: `http://localhost:3000/admin?section=audit` maps to the security audit view and now displays permission/API errors instead of a blank screen.

Store-credit controls have been removed. Current product images and product media references are intentional application data; do not replace or delete them during cleanup or deployment.

## Payments and webhooks

Public provider endpoints are:

- `POST /api/webhooks/stripe/`
- `POST /api/webhooks/razorpay/`
- `POST /api/webhooks/paypal/`
- `POST /api/webhooks/<gateway>/` for a supported gateway code

Incoming events are authenticated, limited to 1 MiB, deduplicated by provider event ID or signed-body fingerprint, stored, acknowledged, and later processed by the scheduler. Payment-success events verify the order amount and currency before changing financial state.

Outgoing webhook subscriptions are managed in the admin. Destinations must use HTTPS and cannot resolve to loopback, private, link-local, reserved, multicast, or otherwise unsafe addresses. Payloads use canonical JSON and `X-Sclero-Signature` HMAC-SHA256. A newly created or rotated signing secret is shown once; later reads expose only a fingerprint.

The scheduler runs:

```powershell
python manage.py run_scheduler
python manage.py run_scheduler --once
```

Production runs this as the dedicated `scheduler` Compose service. A renewable database lease prevents a second scheduler replica from processing the same periodic workload. It processes incoming and outgoing webhooks, support-mail ingestion, abandoned-cart reminders, review requests, and queued browser push campaigns. Each job records its outcome for operational review; push deliveries use bounded retries and disable expired browser subscriptions.

Gateway readiness:

- COD is available when enabled for the region.
- Stripe live intent verification and refunds are implemented; validate them in a provider sandbox before launch.
- Razorpay live capture verification is implemented; perform sandbox/live acceptance and add stronger provider refund idempotency before relying on automated refunds.
- PayPal webhook verification is implemented, but live checkout charge/refund collection remains unavailable and fails closed.

## Quality checks

Run these before each merge:

```powershell
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
python -m ruff check .
python -m pip check
python -m pip_audit -r requirements.txt
python -m bandit -r apps sclero_backend -x "*/migrations/*,*/tests.py"

cd ..\frontend
npm audit --omit=dev
npm run build
```

On Linux also validate deployment scripts:

```bash
bash -n backend/entrypoint.sh deploy/*.sh
docker compose config
```

## Production deployment

The repeatable workflow targets Ubuntu/Debian. It installs missing Docker,
Compose, nginx, Certbot and supporting packages, while preserving the existing
production environment file, Web Push key, PostgreSQL volume and media volume.

```bash
cp .env.production.example .env
# Fill every required value and keep the file readable only by the operator.
sudo ./deploy/vps-install.sh --email YOUR_CERTBOT_EMAIL
```

The email argument is only required when a TLS certificate must be issued. The
installer generates the Web Push signing key, runs preflight checks, backs up an
existing database and media volume, builds fresh immutable images, replaces all
application containers, applies migrations, collects static assets, converts
legacy embedded images, and waits for health checks. It then verifies that
active homepage banners, products, and every active product's image reference
survived the release. Persistent volumes are never deleted by the deployment.
If replacement or validation fails, it makes a best-effort switch back to the
previous application images; the verified database/media backup remains the
authoritative rollback point for migrations or content.

Before replacement, the candidate image runs Django's production configuration,
model-drift and migration-plan checks against the live database without changing
it. If a later health check fails, the failed container logs are captured under
`/var/log/sclero-proteins/` before the previous images are restored.

The host nginx is the only public listener and owns the HTTP-to-HTTPS redirect.
Django deliberately accepts private HTTP from the isolated Compose network so
health probes and Next.js server-side API calls are not redirected internally.

After the one-time `.env` setup, every release is deployed from the clean,
already-updated checkout with one command:

```bash
git pull --ff-only
sudo ./deploy/vps-install.sh
```

Do not use `docker compose down --volumes`, `docker volume rm`, or manually
delete `/var/backups/sclero-proteins`; those operations can destroy the current
catalogue or uploaded images. `--skip-release-backup` is intended only for a
confirmed empty first installation.

`deploy/vps-update.sh` remains as a convenience command when the script should
perform the fast-forward pull as well. It delegates deployment to the same
verified installer. Database migrations are forward-only; restore the paired
database/media backup when a data rollback is required.

### Moving the current live store to a new VPS

Do not delete the existing deployment first. Use a staged cutover so the current products, database records, banners and uploaded images remain recoverable:

1. Lower DNS TTL in advance and place the old store in a short maintenance/read-only window before the final export.
2. Run `deploy/backup.sh` on the old host and securely copy both timestamp-matched database and media archives to the new VPS.
3. Install the new stack without changing DNS, then restore into it:

   ```bash
   bash deploy/restore.sh database-TIMESTAMP.sql.gz media-TIMESTAMP.tar.gz --confirm-replace
   ```

4. Validate products, variants, stock, banners, product/media URLs, shipping, checkout, customer accounts, SMTP, push, payments and webhooks through the new VPS loopback/temporary hostname.
5. Switch DNS only after acceptance checks pass. Keep the old deployment and its final backup intact for rollback until logs, orders and payment callbacks are stable through the agreed observation window.
6. Retire the old stack only after confirming no webhook provider, payment gateway, SMTP record, scheduled job or DNS record still targets it.

Useful operations:

```bash
docker compose ps
docker compose logs --tail=200 backend scheduler frontend edge db
curl -fsS -H "Host: YOUR_PRIMARY_DOMAIN" http://127.0.0.1:18088/api/health/ready/
./deploy/backup.sh
bash deploy/restore.sh DATABASE.sql.gz MEDIA.tar.gz --confirm-replace
```

Backups are not proven until a restore drill succeeds on a separate database and the restored media files are opened successfully.

## Folder structure

```text
backend/
  apps/                    Django domain applications
    push_notifications/    browser subscriptions, campaigns and durable deliveries
  sclero_backend/          settings, URLs, health and server entry points
  entrypoint.sh            migration/static/startup entry point
  requirements.txt         locked Python requirements
frontend/
  app/                     Next.js App Router pages
  components/              shared storefront and admin UI
  hooks/, lib/, store/     bootstrap, API, utilities and Redux state
  public/                  maintained static assets, including current product imagery
deploy/                    install, update, backup, preflight and nginx templates
nginx/                     Compose edge nginx configuration
docs/                      maintained engineering documentation
docker-compose.yml         production service topology
```

## Development guidelines

- Keep business rules in services/models and expose editable values through an authorized admin interface.
- Use serializers and database constraints for validation; never trust browser-computed totals or payment state.
- Keep external calls bounded by timeouts, idempotency, retry limits and safe error messages.
- Never perform durable work only in a request-thread background thread; queue it in the database for the scheduler.
- Add migrations for schema changes and tests for security, payment, shipping and permission behavior.
- Preserve unrelated working-tree changes and all current product image assets/references.
- Use focused comments for security invariants and non-obvious decisions; avoid comments that merely restate code.
- Run the quality checks above before requesting review.
- Keep `.github/workflows/ci.yml` green; financial, authorization, schema, webhook, and deployment changes still require human review even when automation passes.

## Contribution process

1. Create a focused branch.
2. Describe the user-visible behavior and migration/operations impact.
3. Add or update automated tests.
4. Run backend checks, dependency audits, and the frontend production build.
5. Request review for authorization, financial, personal-data, webhook, deployment or schema changes.
6. Update this README and `docs/HARDCODED_VALUES.md` when configuration boundaries change.

## Maintenance and scaling

- Monitor API error rate, scheduler failures, webhook DLQ growth, queue age, payment discrepancies, database connections, disk usage and backup age.
- Rotate credentials and webhook secrets on a documented schedule.
- Add Redis/Celery or another durable worker queue before horizontally scaling high-volume webhook and email processing; the scheduler itself is protected by a database lease.
- Move media to object storage/CDN before multiple backend replicas.
- Add database connection pooling and review indexes with production query telemetry.
- Store gateway and runtime SMTP secrets in a managed secret service or add application-level field encryption before granting broad database access; API responses already redact these values, but the current database remains the configuration source of record.
- Keep browser JWTs in Secure HttpOnly cookies; non-browser API clients may continue using Bearer headers.
- Tighten CSP by eliminating `unsafe-inline` through nonces/hashes.
- Add browser end-to-end coverage for regional checkout, admin shipping, payments, auth and content publishing.
- Split the large admin page into domain modules as a controlled refactor; its current behavior is tested and build-safe, but smaller modules will reduce future change risk.
- Complete newsletter double opt-in and consent evidence before sending marketing mail in jurisdictions where confirmation is required.

## Production release gate

Code-level checks passing is necessary but not sufficient. Release only after all of the following are evidenced in the target environment:

- Docker images build and Compose becomes healthy.
- Migrations complete against a copy of the real PostgreSQL database.
- Host nginx configuration and TLS renewal dry-run pass for every domain.
- SMTP and IMAP test messages succeed without exposing credentials.
- Browser push opt-in, renewal, click-through, cancellation, delivery retry and expired-subscription handling pass on supported desktop and mobile browsers.
- Contact, bulk-enquiry and newsletter submissions persist successfully and their configured notification/confirmation emails arrive.
- Each enabled payment gateway passes amount, currency, duplicate-event, refund and failure-path sandbox tests.
- Incoming and outgoing webhooks pass signature, retry and DLQ tests with real provider/consumer endpoints.
- A database and media backup restores successfully.
- Finance/legal/operations approve taxes, company identifiers, product claims, emails, policies and shipping promises.
- Monitoring and an incident owner are assigned.
- Browser acceptance tests cover every public form’s success, server-failure, invalid-email, invalid-phone and whitespace-only paths, plus password visibility and checkout shipping selection.
- Development runs with `unsafe-eval` only for React debugging; the built production CSP is verified not to contain `unsafe-eval`.
- Production configuration rejects insecure CORS/CSRF origins, local SMTP hosts, conflicting SMTP TLS/SSL settings, wildcard hosts, missing legal identifiers, non-delivery email backends, and SQLite fallback.

Known remaining configurable/static items and recommended migrations are tracked in `docs/HARDCODED_VALUES.md`.

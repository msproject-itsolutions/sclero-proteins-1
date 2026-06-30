# Security and production-readiness report

Date: 2026-06-30  
Scope: Django/DRF backend, Next.js/React frontend, authentication, payments,
uploads, Docker images, Compose topology, nginx, persistence, dependencies, and
shared-VPS operations.

## Executive summary

The application is conditionally ready for a controlled production launch with
COD enabled, after the VPS preflight and go-live checklist in `DEPLOYMENT.md`
passes. It is not ready to accept live Stripe, Razorpay, or PayPal payments:
provider-backed capture/refund adapters do not yet exist. Those gateways now
fail closed and are hidden from production checkout rather than simulating a
successful charge.

The audit fixed the high-risk deployment collision, secret-in-image exposure,
known vulnerable frontend runtime, weak OTP lifecycle, token revocation,
credential disclosure, webhook idempotency, misleading mock business data, and
unsafe payment fallback behavior.

## Fixed critical and high findings

### SEC-001: Online payments could report simulated success

- Severity: Critical
- Status: Fixed safely; live online gateways remain intentionally unavailable
- Location: `backend/apps/orders/payments.py:47-105`, `:188-205`
- Evidence: the base adapters previously returned deterministic sandbox success
  even though provider capture/refund code was absent.
- Impact: an order could be marked paid without money being captured.
- Fix: production test gateways are rejected, unfinished live adapters raise
  `PaymentError`, and only runtime-ready gateways are exposed to checkout.
- Mitigation: keep only COD enabled until each provider adapter has sandbox,
  webhook, refund, reconciliation, and live acceptance tests.

### SEC-002: PayPal webhook verification could be bypassed

- Severity: Critical
- Status: Fixed
- Location: `backend/apps/orders/payments.py:267-319`
- Evidence: the prior verifier returned `True` when
  `PAYPAL_WEBHOOK_VERIFY=False`.
- Impact: forged webhook requests could mark orders paid or refunded.
- Fix: verification now fails closed and calls PayPal's OAuth and
  `verify-webhook-signature` APIs with required transmission headers.
- Mitigation: alert on repeated signature failures and verify live delivery
  from the PayPal dashboard before enabling a future live adapter.

### SEC-003: Public ports conflicted with other VPS projects

- Severity: High
- Status: Fixed
- Location: `docker-compose.yml:1-7`, `:127`
- Evidence: the old app nginx bound host ports 80 and 443.
- Impact: deployment would fail or displace the VPS's existing reverse proxy.
- Fix: Compose now publishes one configurable port on `127.0.0.1` only, scopes
  project resources, and leaves public TLS to host nginx.
- Mitigation: run `deploy/preflight.sh`, inventory listeners, and test host
  nginx before every first deployment.

### SEC-004: Build contexts could copy local secrets into images

- Severity: High
- Status: Fixed
- Location: `backend/.dockerignore:1-19`, `frontend/.dockerignore:1-12`
- Evidence: both Dockerfiles copied their whole build context, while no
  `.dockerignore` existed.
- Impact: backend `.env`, frontend `.env.local`, SQLite data, virtual
  environments, and local build artifacts could enter image layers.
- Fix: explicit Docker ignore rules now exclude secrets, databases, media,
  caches, dependencies, logs, and private key material.
- Mitigation: scan built images in CI and never pass server secrets as Docker
  build arguments.

### SEC-005: Unsupported/vulnerable Node and Next.js runtime

- Severity: High
- Status: Fixed
- Location: `frontend/Dockerfile:4,10,43`; `frontend/package.json:17-29`
- Evidence: Node 20 was end-of-life and `npm audit` reported multiple high
  Next.js advisories on 14.2.35.
- Impact: known request-smuggling, SSRF, cache poisoning, and denial-of-service
  exposure.
- Fix: images use Node 24 LTS; Next is 16.2.9, React 19.2.7, and vulnerable
  nested PostCSS is overridden to 8.5.16.
- Verification: production build passes and `npm audit --omit=dev` reports zero
  known vulnerabilities.

### SEC-006: OTPs were plaintext, non-expiring, and not sent in production

- Severity: High
- Status: Fixed
- Location: `backend/apps/users/views.py:30-61`, `:188-205`, `:593-633`
- Evidence: six-digit codes were stored directly on the user and production
  returned success without SMTP delivery.
- Impact: database readers could use live codes; old codes remained usable; the
  advertised production login flow did not work.
- Fix: codes use cryptographic randomness, salted password hashes, a ten-minute
  expiry, single-use clearing, and actual SMTP delivery. Phone OTP is rejected
  until an SMS provider exists.
- Mitigation: monitor send failures and keep OTP/auth edge throttles enabled.

### SEC-007: Payment credentials were returned to the browser

- Severity: High
- Status: Fixed
- Location: `backend/apps/admin_dashboard/serializers.py:53-72`
- Evidence: the admin serializer returned `secret_key` and `extra_config`.
- Impact: browser compromise, extensions, logs, or an XSS could expose gateway
  credentials.
- Fix: secret fields are write-only and blank edit values preserve the existing
  credential.
- Mitigation: restrict `settings.manage`, require staff TOTP, and rotate any
  credential that may already have been exposed.

### SEC-008: Webhook idempotency had a race condition

- Severity: High
- Status: Fixed
- Location: `backend/apps/orders/models.py:251-258`;
  `backend/apps/orders/migrations/0007_webhookevent_unique_gateway_event.py:4-38`
- Evidence: handlers performed `exists()` followed by `create()` without a
  database uniqueness constraint.
- Impact: simultaneous retries could process one financial event twice.
- Fix: a conditional unique constraint protects `(gateway, event_id)`,
  migrations deduplicate existing rows, and handlers use `get_or_create`.
- Mitigation: continue provider-side idempotency keys for future outbound
  capture/refund calls.

## Fixed medium findings

### SEC-009: Production startup could conceal broken dependencies

- Severity: Medium
- Status: Fixed
- Location: `backend/entrypoint.sh`; `docker-compose.yml:30-143`;
  `backend/sclero_backend/health.py`
- Evidence: database wait and `collectstatic` failures could be ignored; app
  services had no readiness checks.
- Impact: a partially initialized release could accept traffic.
- Fix: entrypoint failures stop the container; database-backed readiness,
  liveness, frontend, edge, and PostgreSQL health checks gate startup.

### SEC-010: Unbounded shared-host resource and log usage

- Severity: Medium
- Status: Fixed
- Location: `docker-compose.yml:37-45`, `:74-82`, `:117-145`
- Evidence: containers had no CPU, memory, PID, or log rotation limits.
- Impact: one project could exhaust a shared VPS and affect unrelated sites.
- Fix: configurable resource budgets, PID caps, graceful stops, and rotating
  JSON logs are now present.

### SEC-011: Password reset tokens and password policy were weak

- Severity: Medium
- Status: Fixed
- Location: `backend/apps/users/views.py:1110`, `:1152-1168`;
  `backend/apps/users/serializers.py:80-82`
- Evidence: reset tokens were stored in plaintext and confirmation only checked
  length eight.
- Impact: a database leak exposed active reset links; weak passwords bypassed
  Django's configured validators.
- Fix: only SHA-256 token digests are stored and register/reset/seed flows use
  Django password validation with a twelve-character minimum.

### SEC-012: Refresh-token rotation could not revoke old tokens

- Severity: Medium
- Status: Fixed
- Location: `backend/sclero_backend/settings.py` (`token_blacklist`,
  `BLACKLIST_AFTER_ROTATION`); `frontend/lib/authFetch.js`
- Evidence: token rotation was enabled while blacklist support was absent and
  the frontend never used the refresh endpoint.
- Impact: stolen refresh tokens remained useful and short access lifetimes
  would break active sessions.
- Fix: blacklist support is enabled; account deletion blacklists outstanding
  tokens; authenticated requests refresh once on 401 and retry.

### SEC-013: Legal and analytics output contained mock values

- Severity: Medium
- Status: Fixed
- Location: `backend/apps/orders/utils.py`, `backend/apps/orders/views.py`,
  `backend/apps/admin_dashboard/views.py`, `frontend/components/Footer.jsx`,
  `frontend/components/TrustpilotWidget.jsx`
- Evidence: a dummy UK VAT number, fabricated traffic conversion, and mock
  Trustpilot ratings existed in production-capable code.
- Impact: legally incorrect invoices and misleading customer/admin statements.
- Fix: legal identifiers are required production configuration, missing
  analytics remains unavailable rather than fabricated, and Trustpilot renders
  only an official configured widget.

### SEC-014: DEBUG silently disabled staff RBAC

- Severity: High
- Status: Fixed
- Location: `backend/sclero_backend/settings.py` (`RBAC_ENFORCED`)
- Evidence: a local HTTP smoke test returned live order data from an admin
  endpoint without authentication because RBAC defaulted off under DEBUG.
- Impact: a development server exposed beyond loopback could disclose or mutate
  customer, order, inventory, and payment administration data.
- Fix: RBAC now defaults on in every environment and can only be disabled
  explicitly for isolated fixture work.

### SEC-015: Integration and system connector secrets were returned

- Severity: High
- Status: Fixed
- Location: `backend/apps/admin_dashboard/serializers.py`
- Evidence: marketing `credentials` and connector setting values containing
  tokens/private keys were serialized back to the admin browser.
- Impact: a browser compromise or privileged XSS could exfiltrate third-party
  credentials.
- Fix: credential fields are write-only/redacted; blank edits preserve existing
  secrets and responses expose only configuration status.

### SEC-016: Staff IP restrictions checked the proxy address

- Severity: Medium
- Status: Fixed
- Location: `backend/apps/users/permissions.py`,
  `backend/apps/audit/context.py`
- Evidence: authorization and login compared rules with `REMOTE_ADDR`, which is
  the internal edge container behind nginx.
- Impact: legitimate users could be locked out or rules could protect only
  against a proxy address rather than the actual client.
- Fix: production trusts the forwarding header only behind the configured proxy,
  the host replaces inbound XFF, and exact IP plus CIDR rules are supported.

## Residual launch risks

### RISK-001: Live online gateway adapters are not implemented

- Severity: High
- Location: `backend/apps/orders/payments.py:95-106`
- Impact: Stripe, Razorpay, and PayPal checkout/capture/refund cannot be offered.
- Current mitigation: fail closed; production checkout exposes COD only.
- Required closure: implement provider SDK/API calls, amount/currency/order
  binding, outbound idempotency keys, refund handling, reconciliation, and
  provider sandbox/live tests.

### RISK-002: JWTs remain in browser localStorage

- Severity: Medium
- Location: `frontend/store/authSlice.js:8-37`;
  `frontend/lib/authFetch.js:10-31`
- Impact: a successful XSS could extract access and refresh tokens.
- Current mitigation: React rendering, sanitized markdown/JSON-LD paths,
  shortened access lifetime, rotation/blacklisting, and no known raw CMS HTML
  sink.
- Required closure: move authentication to same-origin Secure, HttpOnly,
  SameSite cookies with CSRF protection, or a Next.js backend-for-frontend
  session.

### RISK-003: CSP is report-only

- Severity: Medium
- Location: `frontend/next.config.js:46`
- Impact: CSP observes but does not block an injected script.
- Current mitigation: explicit source allowlist and no known unsafe CMS HTML
  rendering.
- Required closure: collect reports in staging, add nonce/hash support where
  needed, then promote to enforced `Content-Security-Policy`.

### RISK-004: Automated test coverage is limited

- Severity: Medium
- Evidence: the repository currently discovers sixteen backend tests and has no
  committed end-to-end browser suite.
- Impact: checkout, auth, admin RBAC, email, uploads, and regional routing can
  regress without CI detection.
- Required closure: add API tests for auth/webhooks/permissions/payments and
  Playwright smoke tests for the launch-critical user journeys.

### RISK-005: Docker and host nginx were not executable in this workstation

- Severity: Operational blocker until verified on the VPS
- Evidence: Docker is not installed in the current Windows environment.
- Impact: image build, Compose health behavior, nginx syntax against the host
  version, real PostgreSQL migration, TLS, and resource limits are not locally
  proven.
- Required closure: complete every command and check in `DEPLOYMENT.md`,
  especially `docker compose up -d --wait`, `nginx -t`, certbot dry-run,
  PostgreSQL migration, backup, and restore drill.

### RISK-006: Business and compliance claims need owner approval

- Severity: Operational/legal
- Scope: addresses, contact numbers, certification, shipping/returns,
  tax registrations, privacy/cookie wording, product claims, and company social
  profiles.
- Required closure: finance/legal/operations must approve the rendered
  storefront, invoices, and email content before DNS cutover.

## Verification evidence

- Django `manage.py check`: passed
- Django migration dry-run: no changes detected
- Backend tests: 16/16 passed
- RBAC audit: 149 sensitive endpoints, 0 ungated
- Python dependency audit: no known vulnerabilities
- Python dependency integrity: passed
- Next.js 16.2.9 production build: passed
- npm production dependency audit: zero known vulnerabilities
- Production Next.js HTTP smoke test: HTTP 200
- Compose YAML parse: passed
- Shell syntax checks: passed
- Django deploy check: only the three intentional edge-owned/cautious HSTS
  warnings remain (`SECURE_SSL_REDIRECT`, HSTS subdomains, HSTS preload)
- Docker image build and live nginx syntax: pending on the deployment host

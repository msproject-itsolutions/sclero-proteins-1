# Remaining hardcoded values register

Reviewed: 2026-07-20

This register separates business-owned values that should move to configuration from intentional protocol, security, UI and seed constants. Product image assets and current product media references are excluded because they are maintained business data and were explicitly preserved.

Do not remove every literal indiscriminately. Business promises, prices, contacts, domains, legal text and integration identifiers must be configurable; protocol constants, validation limits, enums and secure defaults should remain reviewed, version-controlled code.

## Business-owned values still to migrate

| Location | Current value or behavior | Recommendation |
| --- | --- | --- |
| `frontend/lib/region.js`, `frontend/store/regionSlice.js` | UK/India/com host bootstrap and UK initial currency/domain | Generate host routing from an immutable public market manifest or edge configuration. The API/admin already provides authoritative market details after bootstrap. |
| `nginx/conf.d/scleroproteins.conf`, `deploy/nginx/*`, `deploy/vps-install.sh`, `deploy/vps-update.sh` | Sclero domains, default edge port and certificate/site names | These are deployment identity defaults, not storefront admin settings. Render all nginx templates from deployment environment values to support rebranding without repository edits. |
| `frontend/app/admin/page.jsx` | Initial carrier and refund-reason suggestions | Return carrier options from a fulfilment-provider integration. Treat refund reason text only as a harmless editable suggestion. |
| `frontend/app/about/page.jsx`, `frontend/app/faq/page.jsx`, `frontend/app/knowledge-hub/page.jsx`, `frontend/app/bulk/page.jsx`, `frontend/app/contact/ContactClient.jsx`, `frontend/app/policies/[slug]/page.jsx`, `frontend/app/[category]/*` | Static marketing/legal copy, policy dates, fulfilment promises, return windows, metadata, structured data and some product-claim content | Continue migrating business and legal copy into content pages/homepage settings with publishing validation, versioning and legal approval. Keep only layout and safe empty-state copy in code. |
| `frontend/lib/homepageContent.js` | Default homepage content | Defaults prevent an empty new installation. Add an explicit “publish initial content” setup step, then reduce code defaults to schema-safe empty values. |
| `frontend/components/admin/ProductEditorPanel.jsx` | Legacy GBP base-price label | Remove the legacy base price after data migration confirms every product has regional prices; use selected market currency meanwhile. |
| `backend/apps/products/views.py` | Typo corrections and product-search synonym groups | Move merchandising synonyms into an admin-managed search configuration or a dedicated search service with analytics-driven tuning. Keep a small reviewed fallback so new installations remain searchable. |
| `frontend/app/layout.jsx` | Required “Designed by MSProject (msproject.in)” attribution | Keep as a reviewed contractual attribution. Move it to protected branding settings only if administrators should be allowed to change or remove it. |
| `backend/apps/admin_dashboard/management/commands/seed_email_templates.py` | UK/India example currency wording | Keep only as opt-in starter templates or create templates per region through an installation wizard. Admin-edited database templates are authoritative at runtime. |
| `backend/apps/admin_dashboard/management/commands/seed_rbac.py`, `backend/apps/regions/management/commands/seed_db.py`, other seed commands | Demo users, regions, domains, catalog examples and audit records | Split demo fixtures from production bootstrap. Require explicit emails/regions via command arguments or environment and never run demo seeds in production. The unused marketing/customer demo seed and deprecated bundle no-op were removed. |
| `backend/apps/orders/utils.py`, `backend/apps/orders/email_service.py`, `backend/apps/users/views.py`, `backend/apps/admin_dashboard/views.py` | Invoice prefix/layout, India tax presentation, transactional-email chrome/subjects, report labels and export filenames | Add admin-managed document/email branding and per-market invoice numbering/tax-display policies. Keep protocol identifiers and safe generic filenames in code. |

## Intentional technical constants

These should normally remain version-controlled because changing them affects interoperability, safety, or schema semantics rather than day-to-day merchandising:

- Incoming webhook maximum body size, provider signature formats and supported gateway codes in `backend/apps/orders/views.py` and `backend/apps/orders/payments.py`.
- Webhook retry schedule, maximum attempts, HTTP connect/read timeouts and response truncation in `backend/apps/webhooks/dispatcher.py` and `backend/apps/orders/management/commands/process_webhooks.py`.
- Password/token lifetimes, API throttling defaults and upload ceilings in `backend/sclero_backend/settings.py`; environment overrides exist for operational tuning.
- ISO country/subdivision data in `frontend/lib/isoGeo.js` and regional geo helpers.
- Order/payment status enums, currency decimal precision and database field limits in model definitions.
- Analytics windows and pagination/worker batch ceilings. These are bounded safety defaults; migrate only if operators need routine control.
- UI labels, empty-state messages, validation examples, status colors and icon mappings.
- Docker image versions, health-check intervals, baseline resource limits and the local loopback port; production values are overrideable through `.env` where appropriate.
- CSP provider allowlists in `frontend/next.config.js`. Changes require security review and a frontend rebuild, so these should not be editable by ordinary administrators.

## Values migrated during this audit

- Shipping prices and rules now come only from active admin-managed zones/rates; invented UK/India fallback rates were removed.
- Announcement-bar text and status moved to theme/branding settings.
- Manual-order region, currency, tax, country and payment choices now load from active admin configuration.
- Direct refund limits moved from role/currency code branches into **Payments → Refund Limits**.
- Analytics identifiers are sourced from admin/environment configuration.
- Staff creation no longer supplies a default password.
- Store-credit and fake cart-coupon UI were removed.
- Legal identifiers use environment/region settings rather than dummy invoice values.
- The committed IMAP password fallback was removed; missing credentials now fail visibly.
- Browser JWTs moved from `localStorage` into Secure HttpOnly cookies with rotation and logout blacklisting.
- Production now fails preflight when `DEFAULT_FROM_EMAIL` is missing; the former brand-specific sender fallback was removed.
- Company contact channels, social URLs, invoice identity, storefront copyright and packing-slip identity now use admin/region configuration; empty channels stay hidden instead of showing code-owned contact values.
- Admin-authored navigation and homepage links are restricted to safe public URL schemes before storefront rendering.
- Storefront and email structured links now use the configured site URL instead of a repository-owned production domain.
- The production scheduler now uses a renewable database lease so duplicate replicas cannot process the same periodic work.
- Invoice and packing-slip fields are escaped before being rendered, preventing customer/product content from injecting markup into staff printouts or PDFs.
- Checkout no longer displays or submits invented regional shipping prices; an active admin-managed rate is mandatory.
- The Google Customer Reviews merchant ID now comes from `NEXT_PUBLIC_GOOGLE_MERCHANT_ID`, and its delivery date comes from the selected shipping rate estimate.
- Contact notifications now prefer the admin-managed company support address, while enquiries remain safely stored even if notification delivery is temporarily unavailable.
- Public forms trim input and reject whitespace-only required values on both client and server; password and gateway-secret controls now share a show/hide component.
- Browser push message content, scheduling and destinations are admin-managed; VAPID signing material is generated and mounted as a server secret.
- IMAP enablement, host, port and credentials now come from secure environment/admin configuration, while imported Message-IDs prevent duplicate support tickets.
- Failed transactional emails now enter a durable scheduler queue with bounded retries and a dead-letter state instead of being lost during a temporary SMTP outage.
- External geo-IP lookup is now disabled by default and accepts only an explicitly configured HTTPS provider; Cloudflare headers or a local MaxMind database remain the preferred production sources.
- Variant selection, regional variant pricing, stock limits, order snapshots and weight-based shipping calculations now share one server-validated cart model instead of relying on discarded client metadata.
- Automatically priced products now use the same visibility rule in catalogue lists, category counts, related products and detail pages; catalogue relation loading is bounded rather than query-per-card.
- Production rejects insecure CORS/CSRF origins and local/non-delivery SMTP configuration, and supports mutually exclusive SMTP TLS or SSL settings.

## Review rule

When a new business number, URL, email, price, tax, threshold, promise, legal statement, product claim or integration credential is introduced, either expose it through an authorized configuration surface or add it to this register with an owner and migration plan.

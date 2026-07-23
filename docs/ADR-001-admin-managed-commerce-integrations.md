# ADR-001: Admin-managed commerce provider integrations

**Status:** Accepted  
**Date:** 2026-07-22  
**Deciders:** Sclero Proteins platform owners

## Context

The storefront operates across multiple markets and must allow authorised staff
to configure payment and shipping providers without changing source code or
redeploying the application. The platform must preserve regional routing,
refund integrity, webhook idempotency, least-privilege access, and secret
confidentiality.

Provider APIs are not interchangeable. Arbitrary APIs cannot safely be made
operational from credentials alone because authentication, payment capture,
refund, rate, label, cancellation, and webhook protocols differ. The platform
therefore separates installed provider adapters from admin-managed provider
instances. Once an adapter is installed, every market-specific instance is
created and operated entirely through the admin dashboard.

## Decision

Use a registry-and-adapter architecture:

1. An installed provider registry defines the admin form schema, capabilities,
   required credentials, and webhook path.
2. Region-scoped provider records hold enablement, priority, environment,
   encrypted credentials, safe configuration, and health state.
3. Payment and shipping adapters normalize provider-specific APIs behind stable
   application interfaces.
4. The admin dashboard is the control plane for credentials, connection tests,
   routing, enablement, refunds, payment status, and webhook retries.
5. Provider secrets are encrypted before database storage and are write-only in
   every API response. Blank edits preserve existing secrets.
6. Incoming payment webhooks are signature-verified, stored with provider event
   IDs, processed asynchronously, retried with backoff, and replayable by staff.

```text
Admin dashboard
   │ configure / test / enable
   ▼
Provider registry ── validates required fields and capabilities
   │
   ▼
Encrypted regional provider record
   │
   ├── Payment adapter ── charge / status / capture / refund / webhook
   └── Shipping adapter ─ rates / label / pickup / track / cancel
                           │
                           ▼
                    External provider API
```

## Options considered

### Hard-coded environment variables

Low implementation complexity, but every credential or regional routing change
requires developer or deployment access. Rejected.

### Fully generic HTTP templates configured by admins

Appears flexible, but exposes unsafe arbitrary outbound requests and cannot
reliably model provider-specific signing, idempotency, or financial invariants.
Rejected.

### Installed adapters with admin-managed instances

Moderate implementation complexity with strong validation, predictable
operations, and no developer involvement for adding or managing any installed
provider. Accepted.

## Consequences

- Stripe, Razorpay, PayPal, COD, DHL Express, Shiprocket, and manual fulfilment
  can be configured by authorised staff per market.
- Adding another instance or changing keys, webhooks, modes, priorities, or
  regional assignments does not require a deployment.
- Adding a completely new provider protocol still requires one reviewed adapter;
  after installation, its lifecycle is admin-managed.
- The integration encryption key must remain stable and must be held in the
  deployment secret manager. Key rotation requires a controlled re-encryption.
- Provider connection failures remain isolated from core order records and are
  visible to staff.

## Reliability and scale

- Unique provider/event IDs protect webhook processing from duplicates.
- Provider records are indexed by market and enabled state.
- External calls use bounded timeouts and normalized errors.
- Long-running provider work should move to the existing scheduler/queue as
  throughput grows.
- Revisit dedicated workers, circuit breakers, and provider-specific rate
  caches when traffic or label volume materially increases.

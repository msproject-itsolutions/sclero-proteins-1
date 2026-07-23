"""
Transactional email service.

Renders region-aware EmailTemplate rows (managed by staff in the admin panel)
and dispatches via SMTP. SMTP credentials are loaded from
SystemSetting(key='SMTP_SETTINGS') when present, otherwise from Django
settings (EMAIL_HOST / EMAIL_PORT / EMAIL_HOST_USER / EMAIL_HOST_PASSWORD /
EMAIL_USE_TLS / DEFAULT_FROM_EMAIL).

Every send is audited to the AuditLog (action='email.sent' or 'email.failed').
Failures NEVER raise out of this module — the underlying business operation
must keep working even if email is temporarily down.

Available placeholders in a template's subject/body (unknown placeholders are
left in-place rather than crashing):

    {customer_name}     {order_id}          {order_number}
    {total}             {currency}          {currency_symbol}
    {items_table}       {tax_name}          {tax_amount}
    {shipping_cost}     {region_name}       {invoice_url}
    {tracking_url}
"""
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.core.serializers.json import DjangoJSONEncoder
from django.db import IntegrityError, transaction

import json
import logging

from apps.admin_dashboard.models import EmailTemplate, SystemSetting
from apps.audit.recorder import record_audit


logger = logging.getLogger(__name__)


class SafeDict(dict):
    """A dict that leaves unknown {placeholders} intact instead of raising KeyError."""

    def __missing__(self, key):
        return "{" + key + "}"


def _queue_email_retry(event, region, recipient_email, context,
                       audit_target_type, audit_target_id, error):
    """Persist one retry record without ever breaking the caller's workflow."""
    try:
        from apps.orders.models import EmailDelivery

        serializable_context = json.loads(json.dumps(context or {}, cls=DjangoJSONEncoder))
        target_id = str(audit_target_id or '')
        lookup = {
            'event': event,
            'recipient_email': recipient_email,
            'audit_target_type': audit_target_type,
            'audit_target_id': target_id,
            'status__in': ['PENDING', 'FAILED'],
        }
        existing = EmailDelivery.objects.filter(**lookup).first()
        if existing is None:
            try:
                with transaction.atomic():
                    existing = EmailDelivery.objects.create(
                        event=event,
                        region=region,
                        recipient_email=recipient_email,
                        context=serializable_context,
                        audit_target_type=audit_target_type,
                        audit_target_id=target_id,
                        error_message=str(error)[:2000],
                    )
            except IntegrityError:
                # Another worker queued the same target between our read and
                # insert. The conditional database constraint elects one row.
                existing = EmailDelivery.objects.filter(**lookup).first()
        if existing is not None:
            existing.region = region
            existing.context = serializable_context
            existing.error_message = str(error)[:2000]
            existing.save(update_fields=[
                'region', 'context', 'error_message', 'updated_at',
            ])
    except Exception:
        # Email delivery is best-effort at the business-operation boundary;
        # audit logging still records the original failure if queueing is down.
        logger.exception('Could not persist email retry for %s.', event)
        return


def _get_smtp_config():
    """Load SMTP config from SystemSetting('SMTP_SETTINGS') with a Django-settings fallback."""
    cfg = {}
    try:
        row = SystemSetting.objects.filter(key='SMTP_SETTINGS').first()
        if row and isinstance(row.value, dict):
            cfg = dict(row.value)
    except Exception:
        cfg = {}

    def _get(name, default=''):
        return cfg.get(name) if cfg.get(name) not in (None, '') else default

    use_tls_raw = cfg.get('EMAIL_USE_TLS')
    if use_tls_raw is None:
        use_tls = getattr(settings, 'EMAIL_USE_TLS', False)
    else:
        use_tls = str(use_tls_raw).lower() in ('1', 'true', 'yes')

    use_ssl_raw = cfg.get('EMAIL_USE_SSL')
    if use_ssl_raw is None:
        use_ssl = getattr(settings, 'EMAIL_USE_SSL', False)
    else:
        use_ssl = str(use_ssl_raw).lower() in ('1', 'true', 'yes')
    if use_tls and use_ssl:
        raise ValueError('EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be enabled.')

    return {
        'host': _get('EMAIL_HOST', getattr(settings, 'EMAIL_HOST', 'localhost')),
        'port': int(_get('EMAIL_PORT', getattr(settings, 'EMAIL_PORT', 25))),
        'username': _get('EMAIL_HOST_USER', getattr(settings, 'EMAIL_HOST_USER', '')),
        'password': _get('EMAIL_HOST_PASSWORD', getattr(settings, 'EMAIL_HOST_PASSWORD', '')),
        'use_tls': use_tls,
        'use_ssl': use_ssl,
        'timeout': int(_get('EMAIL_TIMEOUT', getattr(settings, 'EMAIL_TIMEOUT', 15))),
        'from_email': _get('DEFAULT_FROM_EMAIL', getattr(settings, 'DEFAULT_FROM_EMAIL', '')),
    }


def _build_order_context(order, extra_context=None):
    """Assemble the full set of order-related placeholders from an Order instance."""
    region = getattr(order, 'region', None)
    region_code = getattr(region, 'code', '') if region else ''
    region_name = getattr(region, 'name', region_code) if region else ''
    currency_symbol = getattr(region, 'currency_symbol', '') if region else ''

    # Items table — simple readable string for plain-text emails.
    items_lines = []
    try:
        for it in order.items.all():
            name = getattr(it.product, 'name', f'Product #{it.product_id}')
            option = f" ({it.variant_name})" if getattr(it, 'variant_name', '') else ''
            items_lines.append(f"{name}{option} x {it.quantity} - {it.price}")
    except Exception:
        logger.exception('Could not render order item rows for order %s.', order.pk)
    items_table = "\n".join(items_lines)

    tax_name = 'GST' if region_code == 'IN' else 'VAT'

    # Invoice URL — absolute if SITE_URL is configured, else the relative media path.
    invoice_url = ''
    invoice = getattr(order, 'invoice', None)
    if invoice and getattr(invoice, 'pdf_file', None):
        try:
            site_url = getattr(settings, 'SITE_URL', '').rstrip('/')
            rel = invoice.pdf_file.url
            invoice_url = f"{site_url}{rel}" if site_url else rel
        except Exception:
            invoice_url = ''

    tracking_url = getattr(order, 'tracking_url', '') or ''

    ctx = {
        'customer_name': order.shipping_name or order.email,
        'order_id': order.id,
        'order_number': order.id,
        'total': order.total,
        'currency': order.currency_code,
        'currency_symbol': currency_symbol,
        'items_table': items_table,
        'tax_name': tax_name,
        'tax_amount': order.tax_amount,
        'shipping_cost': order.shipping_cost,
        'region_name': region_name,
        'invoice_url': invoice_url,
        'tracking_url': tracking_url,
    }
    if extra_context:
        ctx.update(extra_context)
    return ctx


def _escape(text):
    return (str(text)
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;'))


def _wrap_branded_html(subject, body, raw_html_inside=False):
    """Wrap plaintext (or pre-rendered HTML) in branded, mobile-responsive email chrome.

    Inline styles only — most mail clients (Gmail, Outlook, Apple Mail) strip
    <style> blocks. Max-width 600px container, fluid columns, brand colours
    (navy header band, purple accents). Plaintext body is HTML-escaped and
    newlines become <br>. Pre-rendered HTML is trusted (template author's
    responsibility) and inlined verbatim.
    """
    site_url = getattr(settings, 'SITE_URL', '').rstrip('/')
    # Email clients cannot load relative paths, so the logo needs an absolute
    # URL. Admin-set branding wins; otherwise fall back to the shipped asset.
    logo_url = ''
    try:
        from apps.admin_dashboard.models import SystemSetting
        branding = SystemSetting.objects.filter(key='THEME_BRANDING').first()
        if branding and isinstance(branding.value, dict):
            logo_url = (branding.value.get('email_logo_url')
                        or branding.value.get('logo_url') or '')
    except Exception:
        logo_url = ''
    if not logo_url and site_url:
        logo_url = f"{site_url}/logo-header-tagline-v2.png"
    elif logo_url.startswith('/') and site_url:
        logo_url = f"{site_url}{logo_url}"
    company_number = _escape(getattr(settings, 'COMPANY_REGISTRATION_NUMBER', ''))
    gstin = _escape(getattr(settings, 'IN_GSTIN', ''))
    inner = body if raw_html_inside else (
        '<p style="margin:0 0 16px 0;font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F2A44;">'
        + _escape(body).replace('\n\n', '</p><p style="margin:0 0 16px 0;font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F2A44;">').replace('\n', '<br>')
        + '</p>'
    )
    preheader = _escape(subject)[:140]
    return f'''<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>{_escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F2A44;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6FB;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
           style="max-width:600px;width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;
                  box-shadow:0 2px 6px rgba(31,42,68,0.08);">
      <tr><td style="background:#101871;height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr>
        <!-- White header band: the logo artwork is navy-on-transparent, so it
             must sit on a light surface to be visible. Brand navy accent bar above. -->
        <td style="background:#FFFFFF;padding:22px 28px;border-bottom:1px solid #E6EAF2;">
          <a href="{site_url}" style="color:#101871;text-decoration:none;display:inline-block;">
            <!-- Logo, with the wordmark as alt text: many clients block images
                 by default, so the brand must still read without it. -->
            <img src="{logo_url}" alt="Sclero Proteins — no one gives you more" width="170"
                 style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:170px;" />
          </a>
        </td>
      </tr>
      <tr><td style="padding:28px;">{inner}</td></tr>
      <tr>
        <td style="background:#F9FAFC;padding:18px 28px;border-top:1px solid #E6EAF2;
                   font:12px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6B7280;">
          <p style="margin:0 0 6px 0;">
            Sclero Proteins Ltd · Registered in England &amp; Wales {company_number} · GSTIN {gstin}
          </p>
          <p style="margin:0;">
            <a href="{site_url}/policies/privacy" style="color:#890071;text-decoration:none;">Privacy</a> ·
            <a href="{site_url}/policies/terms" style="color:#890071;text-decoration:none;">Terms</a> ·
            <a href="{site_url}/account" style="color:#890071;text-decoration:none;">Manage your account</a>
          </p>
        </td>
      </tr>
    </table>
    <p style="font:11px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#9CA3AF;margin:14px 0 0 0;">
      You are receiving this transactional email because of activity on your Sclero Proteins account.
    </p>
  </td></tr>
</table>
</body></html>'''


def send_branded_email(subject, body, recipient_email):
    """Send a one-off plain-text email wrapped in the branded HTML chrome.

    For system emails that have no admin-managed template (sign-in codes,
    magic links) so every message a customer receives carries the same
    branding. Raises on failure — callers own their retry/fallback policy.
    """
    smtp = _get_smtp_config()
    connection = get_connection(
        host=smtp['host'], port=smtp['port'],
        username=smtp['username'], password=smtp['password'],
        use_tls=smtp['use_tls'], use_ssl=smtp['use_ssl'],
        timeout=smtp['timeout'],
    )
    msg = EmailMultiAlternatives(
        subject=subject, body=body,
        from_email=smtp['from_email'], to=[recipient_email],
        connection=connection,
    )
    msg.attach_alternative(_wrap_branded_html(subject, body), 'text/html')
    msg.send(fail_silently=False)


def send_templated_email(event, region, recipient_email, context,
                          audit_target_type='Order', audit_target_id=None,
                          queue_on_failure=True):
    """Render and send an EmailTemplate for `event` to `recipient_email`.

    Looks up the region-specific template first, then a global (region=None)
    fallback. Returns True on success, False on any failure. Never raises.
    """
    if not recipient_email:
        record_audit(
            'email.failed',
            target_type=audit_target_type,
            target_id=audit_target_id or '',
            summary=f'No recipient for {event}',
            changes={'event': event, 'success': False, 'error': 'no_recipient'},
        )
        return False

    template = None
    try:
        template = EmailTemplate.objects.filter(
            event=event, region=region, is_active=True
        ).first()
        if not template and region is not None:
            template = EmailTemplate.objects.filter(
                event=event, region=None, is_active=True
            ).first()
    except Exception:
        template = None

    if not template:
        record_audit(
            'email.failed',
            target_type=audit_target_type,
            target_id=audit_target_id or '',
            summary=f'No template for {event}',
            changes={'event': event, 'to': recipient_email,
                     'success': False, 'error': 'no_template'},
        )
        if queue_on_failure:
            _queue_email_retry(
                event, region, recipient_email, context,
                audit_target_type, audit_target_id, 'no_template',
            )
        return False

    safe_ctx = SafeDict(context or {})
    try:
        subject = template.subject.format_map(safe_ctx)
        body = template.body.format_map(safe_ctx)
    except Exception as exc:
        record_audit(
            'email.failed',
            target_type=audit_target_type,
            target_id=audit_target_id or '',
            summary=f'Render failure for {event}',
            changes={'event': event, 'to': recipient_email,
                     'success': False, 'error': f'render: {exc}'},
        )
        if queue_on_failure:
            _queue_email_retry(
                event, region, recipient_email, context,
                audit_target_type, audit_target_id, f'render: {exc}',
            )
        return False

    is_html = '<' in body and '>' in body
    if is_html:
        html_body = _wrap_branded_html(subject, body, raw_html_inside=True)
        plain_body = body
    else:
        plain_body = body
        html_body = _wrap_branded_html(subject, body, raw_html_inside=False)

    try:
        smtp = _get_smtp_config()
    except Exception as exc:
        record_audit(
            'email.failed', target_type=audit_target_type,
            target_id=audit_target_id or '', summary=f'SMTP config error for {event}',
            changes={'event': event, 'to': recipient_email,
                     'success': False, 'error': str(exc)},
        )
        if queue_on_failure:
            _queue_email_retry(
                event, region, recipient_email, context,
                audit_target_type, audit_target_id, exc,
            )
        return False

    try:
        connection = get_connection(
            host=smtp['host'],
            port=smtp['port'],
            username=smtp['username'],
            password=smtp['password'],
            use_tls=smtp['use_tls'],
            use_ssl=smtp['use_ssl'],
            timeout=smtp['timeout'],
        )
        msg = EmailMultiAlternatives(
            subject=subject,
            body=plain_body,
            from_email=smtp['from_email'],
            to=[recipient_email],
            connection=connection,
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
    except Exception as exc:
        record_audit(
            'email.failed',
            target_type=audit_target_type,
            target_id=audit_target_id or '',
            summary=subject[:255] if subject else f'Failed: {event}',
            changes={'event': event, 'to': recipient_email,
                     'success': False, 'error': str(exc)},
        )
        if queue_on_failure:
            _queue_email_retry(
                event, region, recipient_email, context,
                audit_target_type, audit_target_id, exc,
            )
        return False

    record_audit(
        'email.sent',
        target_type=audit_target_type,
        target_id=audit_target_id or '',
        summary=subject[:255],
        changes={'event': event, 'to': recipient_email, 'success': True},
    )
    return True


def send_order_email(event, order, extra_context=None):
    """Send a transactional order email (looks up region-specific template first)."""
    ctx = _build_order_context(order, extra_context)
    return send_templated_email(
        event, order.region, order.email, ctx,
        audit_target_type='Order', audit_target_id=order.id,
    )


def send_account_email(event, user, extra_context=None):
    """Send an account-level email (welcome, password reset, etc.) — no region."""
    ctx = {
        'customer_name': getattr(user, 'first_name', '') or user.email,
        'email': user.email,
        'region_name': '',
    }
    if extra_context:
        ctx.update(extra_context)
    return send_templated_email(
        event, None, user.email, ctx,
        audit_target_type='User', audit_target_id=user.id,
    )

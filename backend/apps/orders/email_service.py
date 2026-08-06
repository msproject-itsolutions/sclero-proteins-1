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

    username = _get('EMAIL_HOST_USER', getattr(settings, 'EMAIL_HOST_USER', ''))
    from_email = _get('DEFAULT_FROM_EMAIL', getattr(settings, 'DEFAULT_FROM_EMAIL', ''))
    if not from_email or 'localhost' in from_email:
        if username and '@' in username:
            from_email = username

    return {
        'host': _get('EMAIL_HOST', getattr(settings, 'EMAIL_HOST', 'localhost')),
        'port': int(_get('EMAIL_PORT', getattr(settings, 'EMAIL_PORT', 25))),
        'username': username,
        'password': _get('EMAIL_HOST_PASSWORD', getattr(settings, 'EMAIL_HOST_PASSWORD', '')),
        'use_tls': use_tls,
        'use_ssl': use_ssl,
        'timeout': int(_get('EMAIL_TIMEOUT', getattr(settings, 'EMAIL_TIMEOUT', 15))),
        'from_email': from_email,
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
    site_url = (getattr(settings, 'SITE_URL', '') or 'https://scleroproteins.co.uk').rstrip('/')
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


DEFAULT_TEMPLATES = {
    'order_confirmation': (
        "Order #{order_number} confirmed — thank you, {customer_name}",
        "Hi {customer_name},\n\n"
        "Thank you for your order with Sclero Proteins! We have received order #{order_number} and it is now being processed.\n\n"
        "Items:\n{items_table}\n\n"
        "Subtotal: {currency_symbol}{total}\n"
        "{tax_name}: {currency_symbol}{tax_amount}\n"
        "Shipping: {currency_symbol}{shipping_cost}\n"
        "Total: {currency_symbol}{total} {currency}\n\n"
        "Invoice: {invoice_url}\n\n"
        "We will send you a tracking link as soon as your parcel ships.\n\n"
        "— The Sclero Proteins team"
    ),
    'order_shipped': (
        "Order #{order_number} has shipped!",
        "Hi {customer_name},\n\n"
        "Great news! Your order #{order_number} has been dispatched and is on its way to you.\n\n"
        "Carrier: {carrier}\n"
        "Tracking Number: {tracking_number}\n"
        "Tracking Link: {tracking_url}\n\n"
        "Summary of shipped items:\n{items_table}\n\n"
        "— The Sclero Proteins team"
    ),
    'shipment_dispatched': (
        "Order #{order_number} has shipped!",
        "Hi {customer_name},\n\n"
        "Great news! Your order #{order_number} has been dispatched.\n\n"
        "Tracking Link: {tracking_url}\n\n"
        "— The Sclero Proteins team"
    ),
    'order_delivered': (
        "Order #{order_number} delivered",
        "Hi {customer_name},\n\n"
        "Your order #{order_number} has been delivered. We hope you enjoy your purchase!\n\n"
        "— The Sclero Proteins team"
    ),
    'order_cancelled': (
        "Order #{order_number} cancelled",
        "Hi {customer_name},\n\n"
        "Your order #{order_number} has been cancelled.\n\n"
        "— The Sclero Proteins team"
    ),
    'payment_failed': (
        "Action required: Payment failed for Order #{order_number}",
        "Hi {customer_name},\n\n"
        "We were unable to process the payment for your order #{order_number}.\n\n"
        "— The Sclero Proteins team"
    ),
    'refund_processed': (
        "Refund processed for Order #{order_number}",
        "Hi {customer_name},\n\n"
        "A refund of {currency_symbol}{total} has been issued for order #{order_number}.\n\n"
        "— The Sclero Proteins team"
    ),
    'welcome': (
        "Welcome to Sclero Proteins",
        "Hi {customer_name},\n\n"
        "Welcome to Sclero Proteins! Your account has been created.\n\n"
        "— The Sclero Proteins team"
    ),
    'password_reset': (
        "Reset your Sclero Proteins password",
        "Hi,\n\n"
        "Click the link below to reset your password:\n{reset_url}\n\n"
        "— The Sclero Proteins team"
    ),
    'contact_received': (
        "We received your message",
        "Hi {customer_name},\n\n"
        "Thank you for contacting Sclero Proteins. We have received your enquiry and our support team will respond shortly.\n\n"
        "— The Sclero Proteins team"
    )
}


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

    if not template and event in DEFAULT_TEMPLATES:
        fallback_subj, fallback_body = DEFAULT_TEMPLATES[event]
        template = type('FallbackTemplate', (), {'subject': fallback_subj, 'body': fallback_body})()

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


def send_owner_order_notification(order):
    """Send an immediate, comprehensive new order alert email to the store owner & admins."""
    if not order:
        return False

    recipients = set()
    recipients.add("support@scleroproteins.co.uk")

    if order.region and getattr(order.region, 'company_email', None):
        email = (order.region.company_email or '').strip()
        if email:
            recipients.add(email)

    try:
        from apps.admin_dashboard.models import SystemSetting
        setting = SystemSetting.objects.filter(key='COMPANY_INFO').first()
        if setting and isinstance(setting.value, dict):
            c_email = (setting.value.get('support') or setting.value.get('email') or '').strip()
            if c_email:
                recipients.add(c_email)
    except Exception:
        pass

    try:
        from apps.users.models import User
        admin_emails = User.objects.filter(is_superuser=True, is_active=True).values_list('email', flat=True)
        for em in admin_emails:
            if em and em.strip():
                recipients.add(em.strip())
    except Exception:
        pass

    symbol = order.region.currency_symbol if (order.region and getattr(order.region, 'currency_symbol', None)) else (
        '₹' if order.currency_code == 'INR' else '£' if order.currency_code == 'GBP' else '$'
    )

    order_items = list(order.items.select_related('product').all())
    items_rows = []
    if order_items:
        for item in order_items:
            variant_info = f" ({item.variant_name})" if getattr(item, 'variant_name', '') else ""
            prod_name = getattr(item.product, 'name', '') if getattr(item, 'product', None) else (getattr(item, 'product_name', '') or 'Item')
            prod_sku = getattr(item.product, 'sku', '') if getattr(item, 'product', None) else (getattr(item, 'product_sku', '') or '')
            items_rows.append(
                f"<tr>"
                f"<td style='padding:8px;border-bottom:1px solid #E6EAF2;'><b>{_escape(prod_name)}</b>{_escape(variant_info)}<br/>"
                f"<span style='font-size:11px;color:#6B7280;'>SKU: {_escape(prod_sku)}</span></td>"
                f"<td style='padding:8px;border-bottom:1px solid #E6EAF2;text-align:center;'>{item.quantity}</td>"
                f"<td style='padding:8px;border-bottom:1px solid #E6EAF2;text-align:right;'>{symbol}{item.price:.2f}</td>"
                f"<td style='padding:8px;border-bottom:1px solid #E6EAF2;text-align:right;'><b>{symbol}{(item.quantity * item.price):.2f}</b></td>"
                f"</tr>"
            )
    else:
        items_rows.append(
            f"<tr><td colspan='4' style='padding:12px;text-align:center;color:#6B7280;'>Order items recorded under Order #{order.id}</td></tr>"
        )

    items_table_html = f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin:12px 0;">
        <thead>
            <tr style="background:#101871;color:#FFFFFF;font-weight:bold;text-align:left;">
                <th style="padding:8px;">Product</th>
                <th style="padding:8px;text-align:center;">Qty</th>
                <th style="padding:8px;text-align:right;">Price</th>
                <th style="padding:8px;text-align:right;">Total</th>
            </tr>
        </thead>
        <tbody>
            {"".join(items_rows)}
        </tbody>
    </table>
    """

    subject = f"[NEW ORDER #{order.id}] {symbol}{order.total:.2f} — {_escape(order.shipping_name or order.email)}"
    tax_label = order.region.tax_name if (order.region and getattr(order.region, 'tax_name', None)) else 'Tax'

    html_body = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1F2A44;max-width:600px;">
        <h2 style="color:#101871;margin-top:0;">🎉 New Order Received! (Order #{order.id})</h2>
        <p style="font-size:14px;color:#4B5563;">
            A new order has been placed on Sclero Proteins store and confirmed via <b>{_escape(order.payment_method or 'Online Payment')}</b>.
        </p>

        <div style="background:#F4F6FB;padding:16px;border-radius:8px;margin-bottom:16px;font-size:13px;">
            <h3 style="margin-top:0;color:#101871;font-size:14px;">📦 Customer & Delivery Details</h3>
            <b>Customer Name:</b> {_escape(order.shipping_name or 'N/A')}<br/>
            <b>Email:</b> <a href="mailto:{_escape(order.email)}">{_escape(order.email)}</a><br/>
            <b>Phone:</b> {_escape(order.shipping_phone or 'N/A')}<br/>
            <b>Address:</b> {_escape(order.shipping_address_line1 or '')}{f", {_escape(order.shipping_address_line2)}" if order.shipping_address_line2 else ""}, {_escape(order.shipping_city or '')}, {_escape(order.shipping_state or '')} {_escape(order.shipping_postal_code or '')}, {_escape(order.shipping_country or '')}
        </div>

        <div style="background:#F4F6FB;padding:16px;border-radius:8px;margin-bottom:16px;font-size:13px;">
            <h3 style="margin-top:0;color:#101871;font-size:14px;">💳 Payment Summary</h3>
            <b>Payment Method:</b> {_escape(order.payment_method or 'ONLINE')}<br/>
            <b>Payment Status:</b> <span style="color:#059669;font-weight:bold;">{_escape(order.payment_status or 'PAID')}</span><br/>
            <b>Transaction Reference:</b> {_escape(order.payment_id or 'N/A')}<br/>
            <b>Subtotal:</b> {symbol}{order.subtotal:.2f}<br/>
            <b>Tax ({_escape(tax_label)}):</b> {symbol}{order.tax_amount:.2f}<br/>
            <b>Shipping ({_escape(order.shipping_method or 'Standard')}):</b> {symbol}{order.shipping_cost:.2f}<br/>
            <b style="font-size:15px;color:#101871;">Total Amount Paid: {symbol}{order.total:.2f} {order.currency_code}</b>
        </div>

        <h3 style="color:#101871;font-size:14px;margin-bottom:4px;">🛍️ Purchased Items</h3>
        {items_table_html}

        <p style="margin-top:20px;text-align:center;">
            <a href="https://scleroproteins.co.uk/admin?section=orders" style="background:#101871;color:#FFFFFF;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;display:inline-block;">
                Manage Order in Admin Dashboard →
            </a>
        </p>
    </div>
    """

    success = False
    for recipient in recipients:
        try:
            send_branded_email(subject, html_body, recipient)
            success = True
        except Exception as exc:
            logger.exception("Failed to send admin order alert to %s for order %s", recipient, order.id)

    return success


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

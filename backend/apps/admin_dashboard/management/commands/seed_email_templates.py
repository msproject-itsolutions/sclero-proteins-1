"""Seed the ten core transactional EmailTemplate rows.

Order-flow templates (order_confirmation, order_shipped, order_delivered,
order_cancelled, payment_failed, refund_processed, shipment_dispatched) get
both a global fallback (region=None) AND region-specific UK + IN rows so the
copy can be tuned per market (VAT/GST wording, "warehouse" naming, etc.).
``welcome``, ``password_reset`` and ``contact_received`` are global-only.

Idempotent — re-running fills gaps without overwriting staff edits.
"""
from django.core.management.base import BaseCommand

from apps.admin_dashboard.models import EmailTemplate
from apps.regions.models import Region


SIGNOFF = "— The Sclero Proteins team"


# ---------------------------------------------------------------- Global templates
GLOBAL_TEMPLATES = [
    {
        # Sent by the send_abandoned_cart_reminders job, 24h after a cart goes quiet.
        'event': 'abandoned_cart',
        'subject': 'You left something behind, {customer_name}',
        'body': (
            "Hi {customer_name},\n\n"
            "You left {item_count} item(s) in your basket at Sclero Proteins:\n\n"
            "{items}\n\n"
            "They are still saved — pick up where you left off:\n"
            "{cart_url}\n\n"
            "If you have a question about any of it, just reply to this email "
            "and a human will answer.\n\n"
            + SIGNOFF
        ),
    },
    {
        # Sent by the send_review_requests job, ~30 days after delivery.
        'event': 'review_request',
        'subject': 'How are you getting on with {product_name}?',
        'body': (
            "Hi {customer_name},\n\n"
            "It has been about a month since order #{order_number} arrived, so you "
            "have had a proper chance to try {product_name}.\n\n"
            "If you have a minute, we would love to hear how you are getting on. "
            "Your review helps other people choose with more confidence:\n"
            "{review_url}\n\n"
            "And if something has not lived up to expectations, reply to this "
            "email — we would rather hear it from you directly.\n\n"
            + SIGNOFF
        ),
    },
    {
        'event': 'order_confirmation',
        'subject': 'Order #{order_number} confirmed — thank you, {customer_name}',
        'body': (
            "Hi {customer_name},\n\n"
            "Thanks for your order with Sclero Proteins. We have received order "
            "#{order_number} and it is now being processed.\n\n"
            "Items:\n{items_table}\n\n"
            "Subtotal: {currency_symbol}{subtotal}\n"
            "{tax_name}: {currency_symbol}{tax_amount}\n"
            "Shipping: {currency_symbol}{shipping_cost}\n"
            "Total: {currency_symbol}{total} {currency}\n\n"
            "Invoice: {invoice_url}\n\n"
            "We'll send a tracking link as soon as your parcel ships.\n\n"
            + SIGNOFF
        ),
    },
    {
        'event': 'payment_failed',
        'subject': 'We could not process your payment for order #{order_number}',
        'body': (
            "Hi {customer_name},\n\n"
            "Unfortunately your payment for order #{order_number} could not be "
            "completed. No money has been taken.\n\n"
            "Please try checkout again or contact support if the problem "
            "continues.\n\n"
            + SIGNOFF
        ),
    },
    {
        'event': 'shipment_dispatched',
        'subject': 'Your order #{order_number} is on its way',
        'body': (
            "Hi {customer_name},\n\n"
            "Good news — order #{order_number} has just shipped from our "
            "{region_name} warehouse.\n\n"
            "Track your parcel: {tracking_url}\n\n"
            "Items:\n{items_table}\n\n"
            + SIGNOFF
        ),
    },
    {
        'event': 'refund_processed',
        'subject': 'Refund processed for order #{order_number}',
        'body': (
            "Hi {customer_name},\n\n"
            "We have processed a refund of {currency_symbol}{refund_amount} "
            "{currency} against order #{order_number}. It should appear on your "
            "original payment method within a few business days.\n\n"
            + SIGNOFF
        ),
    },
    {
        'event': 'welcome',
        'subject': 'Welcome to Sclero Proteins',
        'body': (
            "Hi {customer_name},\n\n"
            "Welcome to Sclero Proteins! Your account ({email}) is ready to "
            "use. Browse our latest products and exclusive member offers any "
            "time.\n\n"
            + SIGNOFF
        ),
    },
    {
        'event': 'order_shipped',
        'subject': 'Order #{order_number} has shipped',
        'body': (
            "Hi {customer_name},\n\n"
            "Your order #{order_number} has left our {region_name} warehouse "
            "and is now with the courier.\n\n"
            "Track your parcel: {tracking_url}\n\n"
            "Items in this shipment:\n{items_table}\n\n"
            "Total paid: {currency_symbol}{total} {currency}\n\n"
            + SIGNOFF
        ),
    },
    {
        'event': 'order_delivered',
        'subject': 'Order #{order_number} delivered',
        'body': (
            "Hi {customer_name},\n\n"
            "Great news — your order #{order_number} has been marked as "
            "delivered. We hope everything arrived in great condition.\n\n"
            "If anything is wrong, just reply to this email and our team will "
            "sort it out.\n\n"
            "Invoice: {invoice_url}\n\n"
            + SIGNOFF
        ),
    },
    {
        'event': 'order_cancelled',
        'subject': 'Order #{order_number} cancelled',
        'body': (
            "Hi {customer_name},\n\n"
            "Order #{order_number} has been cancelled. If any payment was "
            "captured, a refund of {currency_symbol}{total} {currency} will be "
            "returned to your original payment method within a few business "
            "days.\n\n"
            "If you didn't request this cancellation, please contact support "
            "right away.\n\n"
            + SIGNOFF
        ),
    },
    {
        'event': 'password_reset',
        'subject': 'Reset your Sclero Proteins password',
        'body': (
            "Hi {customer_name},\n\n"
            "We received a request to reset the password for your Sclero "
            "Proteins account ({email}).\n\n"
            "Reset your password: {reset_url}\n\n"
            "This link will expire in 1 hour. If you didn't request a reset, "
            "you can safely ignore this email — your password will not "
            "change.\n\n"
            + SIGNOFF
        ),
    },
    {
        'event': 'contact_received',
        'subject': 'New enquiry: {enquiry_subject}',
        'body': (
            "A new enquiry has been submitted via the website.\n\n"
            "From: {customer_name} <{email}>\n"
            "Subject: {enquiry_subject}\n\n"
            "Message:\n{enquiry_message}\n\n"
            "Reply to the customer by emailing them directly."
        ),
    },
]


# Region-specific overrides for the order-flow templates. Bodies tweak wording
# (VAT receipt vs GST invoice, despatch vs dispatch, etc.). Only events that
# actually benefit from regional copy are listed here — others fall back to
# the global template by design.
REGION_TEMPLATES = {
    'UK': [
        {
            'event': 'order_confirmation',
            'subject': 'Order #{order_number} confirmed — thanks {customer_name}',
            'body': (
                "Hi {customer_name},\n\n"
                "Thanks for ordering from Sclero Proteins. Order #{order_number} "
                "is confirmed and will be despatched from our UK warehouse.\n\n"
                "Items:\n{items_table}\n\n"
                "Subtotal: {currency_symbol}{subtotal}\n"
                "VAT (20%): {currency_symbol}{tax_amount}\n"
                "Shipping: {currency_symbol}{shipping_cost}\n"
                "Total: {currency_symbol}{total} GBP\n\n"
                "Your VAT receipt: {invoice_url}\n\n"
                + SIGNOFF
            ),
        },
        {
            'event': 'order_shipped',
            'subject': 'Order #{order_number} despatched from our UK warehouse',
            'body': (
                "Hi {customer_name},\n\n"
                "Your order #{order_number} has been despatched and is on its "
                "way to you via Royal Mail / courier.\n\n"
                "Track your parcel: {tracking_url}\n\n"
                "Items:\n{items_table}\n\n"
                + SIGNOFF
            ),
        },
        {
            'event': 'order_delivered',
            'subject': 'Order #{order_number} delivered',
            'body': (
                "Hi {customer_name},\n\n"
                "Your order #{order_number} has been delivered. Hope you "
                "enjoy it!\n\n"
                "VAT receipt: {invoice_url}\n\n"
                + SIGNOFF
            ),
        },
        {
            'event': 'order_cancelled',
            'subject': 'Order #{order_number} cancelled',
            'body': (
                "Hi {customer_name},\n\n"
                "Your UK order #{order_number} has been cancelled. Any payment "
                "taken ({currency_symbol}{total}) will be refunded to the "
                "original payment method within 5 working days.\n\n"
                + SIGNOFF
            ),
        },
        {
            'event': 'refund_processed',
            'subject': 'Refund processed for order #{order_number}',
            'body': (
                "Hi {customer_name},\n\n"
                "We've processed a refund of £{refund_amount} against order "
                "#{order_number}. Funds typically land in your account within "
                "3–5 working days.\n\n"
                + SIGNOFF
            ),
        },
    ],
    'IN': [
        {
            'event': 'order_confirmation',
            'subject': 'Order #{order_number} confirmed — thanks {customer_name}',
            'body': (
                "Hi {customer_name},\n\n"
                "Thanks for ordering from Sclero Proteins India. Order "
                "#{order_number} is confirmed and will ship from our India "
                "warehouse.\n\n"
                "Items:\n{items_table}\n\n"
                "Subtotal: {currency_symbol}{subtotal}\n"
                "GST (18%): {currency_symbol}{tax_amount}\n"
                "Shipping: {currency_symbol}{shipping_cost}\n"
                "Total: {currency_symbol}{total} INR\n\n"
                "Your GST invoice: {invoice_url}\n\n"
                + SIGNOFF
            ),
        },
        {
            'event': 'order_shipped',
            'subject': 'Order #{order_number} shipped from our India warehouse',
            'body': (
                "Hi {customer_name},\n\n"
                "Your order #{order_number} has been shipped and is on the "
                "way.\n\n"
                "Track your parcel: {tracking_url}\n\n"
                "Items:\n{items_table}\n\n"
                + SIGNOFF
            ),
        },
        {
            'event': 'order_delivered',
            'subject': 'Order #{order_number} delivered',
            'body': (
                "Hi {customer_name},\n\n"
                "Your order #{order_number} has been delivered. Thanks for "
                "shopping with us!\n\n"
                "GST invoice: {invoice_url}\n\n"
                + SIGNOFF
            ),
        },
        {
            'event': 'order_cancelled',
            'subject': 'Order #{order_number} cancelled',
            'body': (
                "Hi {customer_name},\n\n"
                "Your India order #{order_number} has been cancelled. If a "
                "payment of ₹{total} was captured, it will be refunded to the "
                "original payment method within 5–7 working days.\n\n"
                + SIGNOFF
            ),
        },
        {
            'event': 'refund_processed',
            'subject': 'Refund processed for order #{order_number}',
            'body': (
                "Hi {customer_name},\n\n"
                "A refund of ₹{refund_amount} has been processed for order "
                "#{order_number}. Expect it in 5–7 working days.\n\n"
                + SIGNOFF
            ),
        },
    ],
}


class Command(BaseCommand):
    help = "Seed default EmailTemplate rows (global + UK/IN region-specific)."

    def handle(self, *args, **options):
        created_count = 0
        skipped_count = 0

        # Global (region=None) rows
        for tpl in GLOBAL_TEMPLATES:
            obj, created = EmailTemplate.objects.get_or_create(
                event=tpl['event'],
                region=None,
                defaults={
                    'subject': tpl['subject'],
                    'body': tpl['body'],
                    'is_active': True,
                },
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created global template: {tpl['event']}"))
            else:
                skipped_count += 1

        # Regional overrides
        for region_code, templates in REGION_TEMPLATES.items():
            region = Region.objects.filter(code=region_code).first()
            if not region:
                self.stdout.write(self.style.WARNING(
                    f"Region {region_code} not found — skipping its templates."
                ))
                continue
            for tpl in templates:
                obj, created = EmailTemplate.objects.get_or_create(
                    event=tpl['event'],
                    region=region,
                    defaults={
                        'subject': tpl['subject'],
                        'body': tpl['body'],
                        'is_active': True,
                    },
                )
                if created:
                    created_count += 1
                    self.stdout.write(self.style.SUCCESS(
                        f"Created {region_code} template: {tpl['event']}"
                    ))
                else:
                    skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done. Created {created_count}, skipped {skipped_count}."
        ))

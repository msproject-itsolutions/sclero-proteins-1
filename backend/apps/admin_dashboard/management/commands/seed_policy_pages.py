"""Seed the storefront policy pages as editable ContentPage rows.

The policy pages (privacy, terms, shipping, refund, cookie, accessibility,
about, contact) were hardcoded in the frontend. Each row created here uses the
reserved ``policy-<slug>`` namespace and stores the structured sections the
policy layout renders in ``template_layout``:

    {
        "kind": "policy",
        "icon": "<icon key>",
        "last_updated_label": "June 23, 2026",
        "is_contact_form": false,
        "sections": [{"heading": "...", "text": "..."}, ...]
    }

Idempotent: existing rows are never overwritten (admin edits win). Run with
--reset to restore a page to these defaults.
"""
from django.core.management.base import BaseCommand

from apps.admin_dashboard.models import ContentPage

POLICY_SLUG_PREFIX = 'policy-'

POLICY_DEFAULTS = {
    'privacy': {
        'title': 'Privacy Policy',
        'icon': 'shield',
        'meta_title': 'Privacy Policy | Sclero Proteins Ltd',
        'meta_description': 'How we collect, use, and protect your personal information at Sclero Proteins.',
        'sections': [
            {
                'heading': '1. Information We Collect',
                'text': 'We collect personal details such as your name, email address, phone number, shipping/billing address, and payment method options when you place an order. We also collect automated analytics data (cookies, IP address, browsing behavior) to improve your storefront experience.',
            },
            {
                'heading': '2. How We Use Your Data',
                'text': 'We process your information to complete transactions, arrange regional shipping, send automated order updates, and—where explicitly opted-in under GDPR or DPDP regulations—send marketing promotions and wellness newsletter updates.',
            },
            {
                'heading': '3. Data Security & Storage',
                'text': 'Your transactions are processed through secure payment gateways (Stripe, Razorpay, PayPal). We implement standard SSL encryption and tokenization. Sclero Proteins does not store raw credit card details on our local database.',
            },
            {
                'heading': '4. Third-Party Sharing',
                'text': 'We share your address details with designated regional courier networks (e.g. DPD, DHL, Blue Dart) to fulfill logistics. We do not sell or lease your personal information to third-party advertisers.',
            },
        ],
    },
    'terms': {
        'title': 'Terms & Conditions',
        'icon': 'file-text',
        'meta_title': 'Terms & Conditions | Sclero Proteins Ltd',
        'meta_description': 'Terms of service and purchasing conditions for Sclero Proteins.',
        'sections': [
            {
                'heading': '1. Agreement to Terms',
                'text': 'By accessing the Sclero Proteins storefront or placing an order, you agree to comply with and be bound by these Terms & Conditions. These terms govern all purchases made in our regional sub-stores (United Kingdom, India, and global channels).',
            },
            {
                'heading': '2. Product Use & Disclaimer',
                'text': 'Our bone & joint care (BJC®) and active protein supplements are formulated for dietary support. They are not intended to diagnose, treat, cure, or prevent any medical condition. Please consult a healthcare professional before starting any new dietary supplement regime.',
            },
            {
                'heading': '3. Pricing & Regional Currency',
                'text': 'Prices are displayed in your detected regional currency (£ for UK, ₹ for India) and include applicable regional taxes (VAT or GST). Sclero Proteins reserves the right to adjust rates, run promotional discounts, or cancel orders due to stock level discrepancies.',
            },
            {
                'heading': '4. Limitation of Liability',
                'text': 'To the maximum extent permitted by law, Sclero Proteins Ltd shall not be liable for any indirect, incidental, or consequential damages resulting from product use or web storefront downtime.',
            },
        ],
    },
    'shipping': {
        'title': 'Shipping Policy',
        'icon': 'truck',
        'meta_title': 'Shipping & Delivery Policy | Sclero Proteins Ltd',
        'meta_description': 'Regional shipping rates, processing times, and free delivery thresholds.',
        'sections': [
            {
                'heading': '1. Processing Times',
                'text': 'Orders are processed within 24 hours on working days. Once dispatched, tracking codes are automatically synced to your customer dashboard and sent via transactional emails.',
            },
            {
                'heading': '2. Regional Courier Partners',
                'text': 'United Kingdom: Shipped via Royal Mail or DPD (2-3 business days tracking). India: Shipped via Blue Dart, Delhivery, or Speed Post (3-5 business days tracking). We maintain local warehouses in Haywards Heath (UK) and Samarkha Anand (India) to assure swift local delivery.',
            },
            {
                'heading': '3. Shipping Rates & Free Thresholds',
                'text': 'United Kingdom: Free standard shipping on orders of £50.00 or more. Orders under £50.00 incur a flat £5.00 delivery fee. India: Free delivery on orders of ₹3,000 or more. Orders below ₹3,000 incur a ₹150 delivery charge.',
            },
            {
                'heading': '4. Customs & International Shipping',
                'text': 'For international orders outside of our core UK/India hubs, delivery duties are calculated at checkout. Customers are responsible for any border customs clearance fees that may arise.',
            },
        ],
    },
    'refund': {
        'title': 'Refund & Return Policy',
        'icon': 'refresh-cw',
        'meta_title': 'Refunds & Returns | Sclero Proteins Ltd',
        'meta_description': 'Learn about our 30-day money-back guarantee and return process.',
        'sections': [
            {
                'heading': '1. 30-Day Money-Back Guarantee',
                'text': 'We are committed to quality. If you are not fully satisfied with your purchase, you can request a full refund within 30 days of purchase. Simply contact our support desk with your order number.',
            },
            {
                'heading': '2. Return Requirements',
                'text': 'To complete a standard return, product tubs should ideally be unopened or have at least 80% of the active contents remaining if requesting a satisfaction refund. Delivery costs for returns are covered by the customer unless the product arrived damaged.',
            },
            {
                'heading': '3. Processing Refunds',
                'text': 'Once approved, refunds are credited back to your original payment method (Stripe, Razorpay, PayPal) within 5 to 7 business days. You will receive an automated refund receipt email.',
            },
        ],
    },
    'cookie': {
        'title': 'Cookie Policy',
        'icon': 'eye',
        'meta_title': 'Cookie Policy | Sclero Proteins Ltd',
        'meta_description': 'How Sclero Proteins uses cookies to improve shopping UX and track analytics.',
        'sections': [
            {
                'heading': '1. What Are Cookies?',
                'text': 'Cookies are small text files placed on your browser to recognize your preferences and keep your active shopping cart items saved across storefront visits.',
            },
            {
                'heading': '2. How We Use Cookies',
                'text': 'We use necessary cookies for session storage and regional routing, analytical cookies to review conversion rates via Google Analytics, and tracking pixels (such as Meta Pixel) to gauge advertisement effectiveness.',
            },
            {
                'heading': '3. Managing Your Choices',
                'text': 'You can adjust your cookie settings through your browser preferences. Restricting functional cookies may cause parts of the checkout and region-switching flows to work incorrectly.',
            },
        ],
    },
    'accessibility': {
        'title': 'Accessibility Statement',
        'icon': 'heart-pulse',
        'meta_title': 'Accessibility | Sclero Proteins Ltd',
        'meta_description': 'Our commitment to web standards and inclusive digital storefront UX.',
        'sections': [
            {
                'heading': '1. Our Standards',
                'text': 'Sclero Proteins Ltd is dedicated to making our digital storefront accessible to all visitors. We build our components in compliance with WCAG 2.1 Level AA accessibility guidelines.',
            },
            {
                'heading': '2. Implementation Features',
                'text': 'Our frontend includes semantic HTML, proper ARIA labels, strong color contrast values, keyboard-navigable dialogs, and alt tags on active product illustrations.',
            },
            {
                'heading': '3. Feedback & Contact',
                'text': 'If you encounter any layout issues or accessibility barriers on our storefront, please reach out to our design team at accessibility@scleroproteins.co.uk.',
            },
        ],
    },
    'about': {
        'title': 'Our Story',
        'icon': 'heart-pulse',
        'meta_title': 'Our Story | Sclero Proteins Ltd',
        'meta_description': 'Learn the story behind Sclero Proteins and our more human, trust-led approach to wellness.',
        'sections': [
            {
                'heading': 'Our Vision',
                'text': 'Sclero Proteins Ltd was founded to challenge the supplement status quo. We believe that what goes into your body should be backed by clinical evidence, manufactured to rigorous pharmaceutical-grade standards, and fully transparent.',
            },
            {
                'heading': 'Focus on Joint and Bone Care (BJC®)',
                'text': 'Our signature BJC® range combines bioactive peptides, minerals, and vitamins specifically researched to support cartilage integrity, bone density, and everyday joint flexibility. We do not use proprietary blends, allowing you to know exactly how much of each ingredient you take.',
            },
            {
                'heading': 'Global Reach & Local Integrity',
                'text': 'With headquarters and fulfillment warehouses in Haywards Heath (UK) and Anand (India), we manufacture locally under GMP compliance, reducing transit emissions and providing direct local customer support.',
            },
        ],
    },
    'contact': {
        'title': 'Contact Us',
        'icon': 'send',
        'meta_title': 'Contact Us | Sclero Proteins Ltd',
        'meta_description': 'Get in touch with Sclero Proteins support team in the UK and India.',
        'is_contact_form': True,
        'sections': [
            {
                'heading': 'Customer Support Hours',
                'text': 'Monday - Friday: 09:00 - 18:00 (GMT / IST). We aim to respond to all inquiries within 1 business day.',
            },
        ],
    },
}

LAST_UPDATED_LABEL = 'June 23, 2026'


def build_policy_defaults(key, spec):
    return {
        'title': spec['title'],
        'page_type': 'STANDARD',
        'content': '',
        'template_layout': {
            'kind': 'policy',
            'icon': spec['icon'],
            'last_updated_label': LAST_UPDATED_LABEL,
            'is_contact_form': bool(spec.get('is_contact_form', False)),
            'sections': spec['sections'],
        },
        'is_published': True,
        'meta_title': spec['meta_title'],
        'meta_description': spec['meta_description'],
    }


class Command(BaseCommand):
    help = 'Seeds the editable policy pages (privacy, terms, shipping, ...). Safe to re-run.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset', action='store_true',
            help='Overwrite existing policy pages with the shipped defaults.',
        )

    def handle(self, *args, **options):
        created = updated = kept = 0
        for key, spec in POLICY_DEFAULTS.items():
            slug = f'{POLICY_SLUG_PREFIX}{key}'
            defaults = build_policy_defaults(key, spec)
            if options['reset']:
                _, was_created = ContentPage.objects.update_or_create(
                    slug=slug, defaults=defaults,
                )
                created += 1 if was_created else 0
                updated += 0 if was_created else 1
            else:
                _, was_created = ContentPage.objects.get_or_create(
                    slug=slug, defaults=defaults,
                )
                created += 1 if was_created else 0
                kept += 0 if was_created else 1
        self.stdout.write(self.style.SUCCESS(
            f'Policy pages seeded: {created} created, {updated} reset, {kept} left as edited.'
        ))

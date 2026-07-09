from django.core.management.base import BaseCommand
from django.db import transaction
from apps.glossary.models import GeneralFAQ

class Command(BaseCommand):
    help = 'Seeds mock General FAQs for the website support center'

    def handle(self, *args, **options):
        self.stdout.write("Seeding General FAQs...")

        faq_data = [
            {
                "question": "What shipping methods do you offer?",
                "answer": "We offer Standard and Express shipping. Domestic orders in the UK are fulfilled via Royal Mail or DPD, and domestic orders in India are fulfilled via Delhivery Courier. Standard delivery takes 2-4 business days, while Express shipping takes 1-2 business days.",
                "category": "Shipping",
                "display_order": 1
            },
            {
                "question": "Do you ship internationally?",
                "answer": "Yes, we ship globally from our regional logistics centers in Haywards Heath (UK) and Anand (India). International delivery times vary depending on the destination country, typically ranging from 5 to 10 business days. Import duties and taxes are calculated during checkout.",
                "category": "Shipping",
                "display_order": 2
            },
            {
                "question": "How can I track my order?",
                "answer": "Once your order is dispatched, you will receive an email notification containing a tracking link. You can also view the status and tracking details directly from your Account Dashboard under the 'Order History' tab.",
                "category": "Shipping",
                "display_order": 3
            },
            {
                "question": "What payment options are available?",
                "answer": "We accept major credit/debit cards (Visa, Mastercard, American Express), PayPal, Razorpay (for domestic Indian transactions), and cash on delivery (COD) for selected regions. All transactions are securely processed through SSL encryption.",
                "category": "Payments",
                "display_order": 1
            },
            {
                "question": "Is my credit card information secure?",
                "answer": "Yes, completely. We do not store any credit card information on our servers. All payments are processed through gateway-agnostic tokenized adapters using Stripe, Razorpay, or PayPal, which comply with PCI-DSS Level 1 security standards.",
                "category": "Payments",
                "display_order": 2
            },
            {
                "question": "What is your return policy?",
                "answer": "We offer a 30-day money-back guarantee on all unopened canisters. If you are unsatisfied with your purchase, please contact our support team at support@scleroproteins.co.uk (UK) or support@scleroproteins.in (India) to initiate a return.",
                "category": "Returns",
                "display_order": 1
            },
            {
                "question": "When will I receive my refund?",
                "answer": "Once we receive and inspect your returned items, we will process your refund back to the original payment method within 5 to 7 business days. You will receive an email confirmation once the transaction is complete.",
                "category": "Returns",
                "display_order": 2
            },
            {
                "question": "Are your formulations GMP-certified?",
                "answer": "Yes, all Sclero Proteins supplements are manufactured in state-of-the-art facilities that adhere strictly to Good Manufacturing Practices (GMP) and local regulatory standards to ensure purity, safety, and label transparency.",
                "category": "Formulations",
                "display_order": 1
            },
            {
                "question": "How should Sclero Proteins products be stored?",
                "answer": "We recommend storing all powders in a cool, dry place away from direct sunlight. Ensure the lid is screwed on tightly after each scoop to prevent moisture assimilation and ensure optimal product shelf life.",
                "category": "Formulations",
                "display_order": 2
            }
        ]

        with transaction.atomic():
            for item in faq_data:
                faq, created = GeneralFAQ.objects.update_or_create(
                    question=item["question"],
                    defaults={
                        "answer": item["answer"],
                        "category": item["category"],
                        "display_order": item["display_order"],
                        "is_active": True
                    }
                )
                action = "Created" if created else "Updated"
                self.stdout.write(f"  {action}: {faq.question}")

        self.stdout.write(self.style.SUCCESS("General FAQs seeded successfully!"))

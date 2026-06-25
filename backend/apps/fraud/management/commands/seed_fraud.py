from django.core.management.base import BaseCommand

from apps.fraud.models import FraudRule


SEED_RULES = [
    {
        'name': '5 orders / 60min / email',
        'kind': 'ORDER_VELOCITY_PER_EMAIL',
        'threshold': 5,
        'window_minutes': 60,
        'severity': 'HIGH',
        'action': 'FLAG',
    },
    {
        'name': 'Order over £500',
        'kind': 'HIGH_VALUE_ORDER',
        'threshold': 500,
        'window_minutes': 0,
        'severity': 'MEDIUM',
        'action': 'FLAG',
    },
]


class Command(BaseCommand):
    help = 'Idempotently seed baseline fraud rules.'

    def handle(self, *args, **options):
        created = 0
        existed = 0
        for spec in SEED_RULES:
            _, was_created = FraudRule.objects.get_or_create(
                name=spec['name'],
                defaults=spec,
            )
            if was_created:
                created += 1
            else:
                existed += 1
        self.stdout.write(f"Seeded {created} fraud rules ({existed} existed)")
